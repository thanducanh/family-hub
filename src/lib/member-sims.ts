import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { type SessionUser } from "@/lib/auth";
import { bankMemberExists, canAccessBankMember } from "@/lib/bank-accounts";
import { pool } from "@/lib/db";
import type { MemberSim, MemberSimCarrier, MemberSimStatus, MemberSimType } from "@/types";

export const memberSimFields = "id, member_id, carrier, phone_number, sim_type, plan_name, monthly_fee, data_amount, billing_cycle_day, renewal_months, renewal_date, last_topup_date, last_topup_amount, sim_balance, next_renewal_date, last_renewal_checked_date, last_reminder_date, status, note, created_at, updated_at";

const carriers: MemberSimCarrier[] = ["Viettel", "MobiFone", "VinaPhone", "Vietnamobile", "Wintel", "Local", "Khác"];
const simTypes: MemberSimType[] = ["personal", "work", "data", "esim", "other"];
const statuses: MemberSimStatus[] = ["active", "paused", "cancelled"];

export async function ensureMemberSimsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS member_sims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID REFERENCES members(id) ON DELETE CASCADE,
      carrier TEXT NOT NULL,
      phone_number TEXT,
      sim_type TEXT DEFAULT 'personal',
      plan_name TEXT,
      monthly_fee NUMERIC DEFAULT 0,
      data_amount TEXT,
      billing_cycle_day INTEGER,
      renewal_months INTEGER DEFAULT 1,
      renewal_date DATE,
      last_topup_date DATE,
      last_topup_amount NUMERIC DEFAULT 0,
      sim_balance NUMERIC DEFAULT 0,
      next_renewal_date DATE,
      last_renewal_checked_date DATE,
      last_reminder_date DATE,
      status TEXT DEFAULT 'active',
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE member_sims ADD COLUMN IF NOT EXISTS last_topup_date DATE");
  await pool.query("ALTER TABLE member_sims ADD COLUMN IF NOT EXISTS last_topup_amount NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE member_sims ADD COLUMN IF NOT EXISTS sim_balance NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE member_sims ADD COLUMN IF NOT EXISTS next_renewal_date DATE");
  await pool.query("ALTER TABLE member_sims ADD COLUMN IF NOT EXISTS renewal_months INTEGER DEFAULT 1");
  await pool.query("ALTER TABLE member_sims ADD COLUMN IF NOT EXISTS last_renewal_checked_date DATE");
  await pool.query("ALTER TABLE member_sims ADD COLUMN IF NOT EXISTS last_reminder_date DATE");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sim_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sim_id UUID REFERENCES member_sims(id) ON DELETE CASCADE,
      member_id UUID REFERENCES members(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_sim_transactions_sim_id ON sim_transactions(sim_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_member_sims_member_id ON member_sims(member_id)");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sim_id UUID REFERENCES member_sims(id) ON DELETE SET NULL");
}

export function memberSimFromRow(row: Record<string, unknown>): MemberSim {
  return {
    id: String(row.id),
    memberId: String(row.member_id || ""),
    carrier: normalizeCarrier(row.carrier),
    phoneNumber: String(row.phone_number || ""),
    simType: normalizeSimType(row.sim_type),
    planName: String(row.plan_name || ""),
    monthlyFee: Number(row.monthly_fee || 0),
    dataAmount: String(row.data_amount || ""),
    billingCycleDay: row.billing_cycle_day === null || row.billing_cycle_day === undefined ? null : Number(row.billing_cycle_day),
    renewalMonths: Math.max(1, Number(row.renewal_months || 1)),
    renewalDate: dbDateToIso(row.renewal_date),
    lastTopupDate: dbDateToIso(row.last_topup_date),
    lastTopupAmount: Number(row.last_topup_amount || 0),
    simBalance: Number(row.sim_balance || 0),
    nextRenewalDate: dbDateToIso(row.next_renewal_date) || dbDateToIso(row.renewal_date),
    lastRenewalCheckedDate: dbDateToIso(row.last_renewal_checked_date),
    lastReminderDate: dbDateToIso(row.last_reminder_date),
    status: normalizeStatus(row.status),
    note: String(row.note || ""),
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
  };
}

export function normalizeMemberSimBody(body: Partial<MemberSim>): MemberSim {
  const data = body as Partial<MemberSim> & Record<string, unknown>;
  const billingCycleDay = Number(data.billingCycleDay || data.billing_cycle_day || 0);
  const renewalMonths = Math.max(1, Number(data.renewalMonths || data.renewal_months || 1));
  const lastTopupAmount = Number(data.lastTopupAmount || data.last_topup_amount || 0);
  const rawBalance = data.simBalance ?? data.sim_balance;
  const simBalance = rawBalance === undefined || rawBalance === null || String(rawBalance) === "" ? lastTopupAmount : Number(rawBalance || 0);
  const lastTopupDate = normalizeIsoDate(data.lastTopupDate || data.last_topup_date);
  const payloadNextRenewalDate = normalizeIsoDate(data.nextRenewalDate || data.next_renewal_date);
  const nextRenewalDate = payloadNextRenewalDate || calculateNextRenewalDate(lastTopupDate, renewalMonths);
  return {
    id: String(data.id || randomUUID()),
    memberId: String(data.memberId || data.member_id || "").trim(),
    carrier: normalizeCarrier(data.carrier),
    phoneNumber: String(data.phoneNumber || data.phone_number || "").trim(),
    simType: normalizeSimType(data.simType || data.sim_type),
    planName: String(data.planName || data.plan_name || "").trim(),
    monthlyFee: Number(data.monthlyFee || data.monthly_fee || 0),
    dataAmount: String(data.dataAmount || data.data_amount || "").trim(),
    billingCycleDay: billingCycleDay >= 1 && billingCycleDay <= 31 ? billingCycleDay : null,
    renewalMonths,
    renewalDate: nextRenewalDate,
    lastTopupDate,
    lastTopupAmount,
    simBalance,
    nextRenewalDate,
    status: normalizeStatus(data.status),
    note: String(data.note || "").trim(),
  };
}

export async function requireMemberSimAccess(user: SessionUser, id: string) {
  const result = await pool.query(`SELECT ${memberSimFields} FROM member_sims WHERE id = $1`, [id]);
  const row = result.rows[0];
  if (!row) return { error: NextResponse.json({ ok: false, error: "Không tìm thấy SIM/Data." }, { status: 404 }) };
  if (!await canAccessBankMember(user, String(row.member_id))) return { error: NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 }) };
  return { sim: memberSimFromRow(row) };
}

export async function upsertMemberSim(sim: MemberSim) {
  const result = await pool.query(
    `INSERT INTO member_sims (id, member_id, carrier, phone_number, sim_type, plan_name, monthly_fee, data_amount, billing_cycle_day, renewal_months, renewal_date, last_topup_date, last_topup_amount, sim_balance, next_renewal_date, status, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (id) DO UPDATE SET member_id = EXCLUDED.member_id, carrier = EXCLUDED.carrier, phone_number = EXCLUDED.phone_number, sim_type = EXCLUDED.sim_type, plan_name = EXCLUDED.plan_name, monthly_fee = EXCLUDED.monthly_fee, data_amount = EXCLUDED.data_amount, billing_cycle_day = EXCLUDED.billing_cycle_day, renewal_months = EXCLUDED.renewal_months, renewal_date = EXCLUDED.renewal_date, last_topup_date = EXCLUDED.last_topup_date, last_topup_amount = EXCLUDED.last_topup_amount, sim_balance = EXCLUDED.sim_balance, next_renewal_date = EXCLUDED.next_renewal_date, status = EXCLUDED.status, note = EXCLUDED.note, updated_at = now()
     RETURNING ${memberSimFields}`,
    [sim.id, sim.memberId || null, sim.carrier, sim.phoneNumber || null, sim.simType, sim.planName || null, sim.monthlyFee || 0, sim.dataAmount || null, sim.billingCycleDay, sim.renewalMonths || 1, sim.nextRenewalDate || sim.renewalDate || null, sim.lastTopupDate || null, sim.lastTopupAmount || 0, sim.simBalance || 0, sim.nextRenewalDate || null, sim.status, sim.note || ""]
  );
  return memberSimFromRow(result.rows[0]);
}

export async function topUpMemberSim(input: { simId: string; amount: number; transactionDate: string; note?: string }) {
  const amount = Math.max(0, Number(input.amount || 0));
  const transactionDate = normalizeIsoDate(input.transactionDate) || todayIso();
  const current = await pool.query(`SELECT ${memberSimFields} FROM member_sims WHERE id = $1`, [input.simId]);
  const sim = current.rows[0];
  if (!sim) throw new Error("SIM/Data không tồn tại.");
  const result = await pool.query(
    `UPDATE member_sims
     SET sim_balance = COALESCE(sim_balance, 0) + $2,
         last_topup_date = $3,
         last_topup_amount = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING ${memberSimFields}`,
    [input.simId, amount, transactionDate]
  );
  await pool.query(
    `INSERT INTO sim_transactions (sim_id, member_id, type, amount, transaction_date, note)
     VALUES ($1, $2, 'topup', $3, $4, $5)`,
    [input.simId, sim.member_id, amount, transactionDate, input.note || ""]
  );
  return memberSimFromRow(result.rows[0]);
}

export async function checkMemberSimRenewals() {
  const today = todayIso();
  const tomorrow = addDaysToDateOnly(today, 1);
  const result = await pool.query(`SELECT ${memberSimFields} FROM member_sims WHERE status = 'active' ORDER BY created_at DESC`);
  const actions: string[] = [];
  for (const row of result.rows) {
    const sim = memberSimFromRow(row);
    const label = sim.phoneNumber || sim.planName || sim.carrier || "SIM/Data";
    const plan = sim.planName || "gói cước";
    const fee = Number(sim.monthlyFee || 0);
    const balance = Number(sim.simBalance || 0);
    if (!sim.nextRenewalDate || fee <= 0) continue;

    if (sim.nextRenewalDate === tomorrow && sim.lastReminderDate !== today) {
      if (balance >= fee) {
        await createSimNotification(`SIM ${label} sẽ gia hạn ngày mai. Số dư đủ, dự kiến trừ ${formatMoney(fee)}.`);
      } else {
        await createSimNotification(`SIM ${label} sẽ gia hạn ngày mai nhưng thiếu ${formatMoney(fee - balance)}. Cần nạp thêm.`);
      }
      await pool.query("UPDATE member_sims SET last_reminder_date = $2, updated_at = now() WHERE id = $1", [sim.id, today]);
      actions.push(`reminder:${sim.id}`);
    }

    if (sim.nextRenewalDate === today && sim.lastRenewalCheckedDate !== today) {
      if (balance >= fee) {
        const newBalance = balance - fee;
        const nextRenewalDate = addMonthsToDateOnly(sim.nextRenewalDate, sim.renewalMonths || 1);
        await pool.query(
          `UPDATE member_sims
           SET sim_balance = $2,
               next_renewal_date = $3,
               renewal_date = $3,
               last_renewal_checked_date = $4,
               updated_at = now()
           WHERE id = $1`,
          [sim.id, newBalance, nextRenewalDate || null, today]
        );
        await pool.query(
          `INSERT INTO sim_transactions (sim_id, member_id, type, amount, transaction_date, note)
           VALUES ($1, $2, 'renewal', $3, $4, $5)`,
          [sim.id, sim.memberId || null, -fee, today, `Tự gia hạn ${plan}`]
        );
        await createSimNotification(`SIM ${label} đã tự gia hạn gói ${plan}, trừ ${formatMoney(fee)}. Số dư còn ${formatMoney(newBalance)}.`);
        actions.push(`renewal:${sim.id}`);
      } else {
        await createSimNotification(`SIM ${label} sắp/đã đến hạn nhưng thiếu ${formatMoney(fee - balance)} để gia hạn gói ${plan}.`);
        await pool.query("UPDATE member_sims SET last_renewal_checked_date = $2, updated_at = now() WHERE id = $1", [sim.id, today]);
        actions.push(`insufficient:${sim.id}`);
      }
    }
  }
  return { checked: result.rows.length, actions };
}

export async function validateMemberSimAccess(user: SessionUser, sim: MemberSim) {
  if (!sim.memberId || !sim.carrier) return NextResponse.json({ ok: false, error: "Vui lòng nhập thành viên sở hữu và nhà mạng." }, { status: 400 });
  if (!await bankMemberExists(sim.memberId)) return NextResponse.json({ ok: false, error: "Không tìm thấy thành viên." }, { status: 404 });
  if (!await canAccessBankMember(user, sim.memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
  return null;
}

function normalizeCarrier(value: unknown): MemberSimCarrier {
  const text = String(value || "").trim();
  return carriers.includes(text as MemberSimCarrier) ? text as MemberSimCarrier : "Khác";
}

function normalizeSimType(value: unknown): MemberSimType {
  const text = String(value || "").trim();
  return simTypes.includes(text as MemberSimType) ? text as MemberSimType : "personal";
}

function normalizeStatus(value: unknown): MemberSimStatus {
  const text = String(value || "").trim();
  return statuses.includes(text as MemberSimStatus) ? text as MemberSimStatus : "active";
}

async function createSimNotification(message: string) {
  await pool.query(
    `INSERT INTO notifications (title, message, created_by_name, visible_user_ids)
     VALUES ($1, $2, 'Family Hub', '[]'::jsonb)`,
    ["SIM/Data", message]
  );
}

function dbDateToIso(value: unknown) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  return normalizeIsoDate(value);
}

function normalizeIsoDate(value: unknown) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDaysToDateOnly(isoDate: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
}

function calculateNextRenewalDate(lastTopupDate: unknown, renewalMonths: number) {
  const source = String(lastTopupDate || "");
  return addMonthsToDateOnly(source, renewalMonths);
}

function addMonthsToDateOnly(isoDate: string, months: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const resultMonthIndex = (m - 1) + Number(months || 0);
  if (Number.isNaN(resultMonthIndex) || resultMonthIndex < 0) return "";
  const newYear = y + Math.floor(resultMonthIndex / 12);
  const newMonth = (resultMonthIndex % 12) + 1;
  const lastDay = new Date(newYear, newMonth, 0).getDate();
  const newDay = Math.min(d, lastDay);
  return `${newYear}-${String(newMonth).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;
}
