import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { type SessionUser } from "@/lib/auth";
import { bankMemberExists, canAccessBankMember } from "@/lib/bank-accounts";
import { pool } from "@/lib/db";
import type { MemberSim, MemberSimCarrier, MemberSimStatus, MemberSimType } from "@/types";

export const memberSimFields = "id, member_id, carrier, phone_number, sim_type, plan_name, monthly_fee, data_amount, billing_cycle_day, billing_cycle_type, renewal_months, renewal_date, renew_day, auto_renew, last_topup_date, last_topup_amount, sim_balance, next_renewal_date, last_renewal_checked_date, last_reminder_date, status, note, created_at, updated_at";
export const simPlanHistoryFields = "id, sim_id, phone_number, old_plan_name, old_plan_price, old_cycle, old_cycle_months, new_plan_name, new_plan_price, new_cycle, new_cycle_months, effective_month, effective_year, effective_date, note, created_at";
export const simMonthlyPaymentFields = "id, sim_id, phone_number, month, year, plan_name, amount, topup_amount, plan_fee, billing_cycle_months, coverage_start_date, coverage_end_date, renew_date, paid_date, status, note, transaction_id, created_at, updated_at";

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
  await pool.query("ALTER TABLE member_sims ADD COLUMN IF NOT EXISTS billing_cycle_type TEXT DEFAULT 'monthly'");
  await pool.query("ALTER TABLE member_sims ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true");
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sim_plan_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sim_id UUID REFERENCES member_sims(id) ON DELETE CASCADE,
      phone_number TEXT NOT NULL,
      old_plan_name TEXT,
      old_plan_price NUMERIC DEFAULT 0,
      new_plan_name TEXT,
      new_plan_price NUMERIC DEFAULT 0,
      effective_month INTEGER,
      effective_year INTEGER,
      effective_date DATE,
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_sim_plan_history_sim_id ON sim_plan_history(sim_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_sim_plan_history_phone_year ON sim_plan_history(phone_number, effective_year, effective_month)");
  await pool.query("ALTER TABLE sim_plan_history ADD COLUMN IF NOT EXISTS old_cycle TEXT");
  await pool.query("ALTER TABLE sim_plan_history ADD COLUMN IF NOT EXISTS old_cycle_months INTEGER");
  await pool.query("ALTER TABLE sim_plan_history ADD COLUMN IF NOT EXISTS new_cycle TEXT");
  await pool.query("ALTER TABLE sim_plan_history ADD COLUMN IF NOT EXISTS new_cycle_months INTEGER");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sim_monthly_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sim_id UUID REFERENCES member_sims(id) ON DELETE CASCADE,
      phone_number TEXT NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      plan_name TEXT,
      amount NUMERIC DEFAULT 0,
      paid_date DATE,
      status TEXT DEFAULT 'paid',
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (sim_id, year, month)
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_sim_monthly_payments_sim_year ON sim_monthly_payments(sim_id, year, month)");
  await pool.query("ALTER TABLE sim_monthly_payments ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE");
  await pool.query("ALTER TABLE sim_monthly_payments ADD COLUMN IF NOT EXISTS topup_amount NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE sim_monthly_payments ADD COLUMN IF NOT EXISTS plan_fee NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE sim_monthly_payments ADD COLUMN IF NOT EXISTS billing_cycle_months INTEGER DEFAULT 1");
  await pool.query("ALTER TABLE sim_monthly_payments ADD COLUMN IF NOT EXISTS coverage_start_date DATE");
  await pool.query("ALTER TABLE sim_monthly_payments ADD COLUMN IF NOT EXISTS coverage_end_date DATE");
  await pool.query("ALTER TABLE sim_monthly_payments ADD COLUMN IF NOT EXISTS renew_date DATE");
  await pool.query("ALTER TABLE member_sims ADD COLUMN IF NOT EXISTS renew_day INTEGER");
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
    billingCycleType: String(row.billing_cycle_type || cycleTypeFromMonths(Number(row.renewal_months || 1))),
    renewalMonths: Math.max(1, Number(row.renewal_months || 1)),
    renewalDate: dbDateToIso(row.renewal_date),
    renewDay: row.renew_day === null || row.renew_day === undefined ? null : Number(row.renew_day),
    autoRenew: row.auto_renew !== false,
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

export function simPlanHistoryFromRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    simId: String(row.sim_id || ""),
    phoneNumber: String(row.phone_number || ""),
    oldPlanName: String(row.old_plan_name || ""),
    oldPlanPrice: Number(row.old_plan_price || 0),
    oldCycle: String(row.old_cycle || ""),
    oldCycleMonths: Number(row.old_cycle_months || 0),
    newPlanName: String(row.new_plan_name || ""),
    newPlanPrice: Number(row.new_plan_price || 0),
    newCycle: String(row.new_cycle || ""),
    newCycleMonths: Number(row.new_cycle_months || 0),
    effectiveMonth: Number(row.effective_month || 0),
    effectiveYear: Number(row.effective_year || 0),
    effectiveDate: dbDateToIso(row.effective_date),
    note: String(row.note || ""),
    createdAt: row.created_at ? String(row.created_at) : "",
  };
}

export function simMonthlyPaymentFromRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    simId: String(row.sim_id || ""),
    phoneNumber: String(row.phone_number || ""),
    month: Number(row.month || 0),
    year: Number(row.year || 0),
    planName: String(row.plan_name || ""),
    amount: Number(row.amount || 0),
    topupAmount: Number(row.topup_amount || row.amount || 0),
    planFee: Number(row.plan_fee || 0),
    billingCycleMonths: Math.max(1, Number(row.billing_cycle_months || 1)),
    coverageStartDate: dbDateToIso(row.coverage_start_date),
    coverageEndDate: dbDateToIso(row.coverage_end_date),
    renewDate: dbDateToIso(row.renew_date),
    paidDate: dbDateToIso(row.paid_date),
    status: String(row.status || "paid"),
    note: String(row.note || ""),
    transactionId: row.transaction_id ? String(row.transaction_id) : undefined,
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
  };
}

export function normalizeMemberSimBody(body: Partial<MemberSim>): MemberSim {
  const data = body as Partial<MemberSim> & Record<string, unknown>;
  const billingCycleDay = Number(data.billingCycleDay || data.billing_cycle_day || 0);
  const rawCycleType = String(data.billingCycleType || data.billing_cycle_type || "").trim();
  const billingCycleType = normalizeBillingCycleType(rawCycleType || cycleTypeFromMonths(Number(data.renewalMonths || data.renewal_months || 1)));
  const renewalMonths = billingCycleType === "custom" ? Math.max(1, Number(data.renewalMonths || data.renewal_months || 1)) : monthsFromCycleType(billingCycleType);
  const lastTopupAmount = Number(data.lastTopupAmount || data.last_topup_amount || 0);
  const rawBalance = data.simBalance ?? data.sim_balance;
  const simBalance = rawBalance === undefined || rawBalance === null || String(rawBalance) === "" ? lastTopupAmount : Number(rawBalance || 0);
  const lastTopupDate = normalizeIsoDate(data.lastTopupDate || data.last_topup_date);
  const payloadNextRenewalDate = normalizeIsoDate(data.nextRenewalDate || data.next_renewal_date);
  const nextRenewalDate = payloadNextRenewalDate || calculateNextRenewalDate(lastTopupDate, renewalMonths);
  const renewDay = Number(data.renewDay || data.renew_day || 0);
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
    billingCycleType,
    renewalMonths,
    renewalDate: nextRenewalDate,
    renewDay: renewDay >= 1 && renewDay <= 31 ? renewDay : null,
    autoRenew: data.autoRenew === false || data.auto_renew === false ? false : true,
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
    `INSERT INTO member_sims (id, member_id, carrier, phone_number, sim_type, plan_name, monthly_fee, data_amount, billing_cycle_day, billing_cycle_type, renewal_months, renewal_date, renew_day, auto_renew, last_topup_date, last_topup_amount, sim_balance, next_renewal_date, status, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     ON CONFLICT (id) DO UPDATE SET member_id = EXCLUDED.member_id, carrier = EXCLUDED.carrier, phone_number = EXCLUDED.phone_number, sim_type = EXCLUDED.sim_type, plan_name = EXCLUDED.plan_name, monthly_fee = EXCLUDED.monthly_fee, data_amount = EXCLUDED.data_amount, billing_cycle_day = EXCLUDED.billing_cycle_day, billing_cycle_type = EXCLUDED.billing_cycle_type, renewal_months = EXCLUDED.renewal_months, renewal_date = EXCLUDED.renewal_date, renew_day = EXCLUDED.renew_day, auto_renew = EXCLUDED.auto_renew, last_topup_date = EXCLUDED.last_topup_date, last_topup_amount = EXCLUDED.last_topup_amount, sim_balance = EXCLUDED.sim_balance, next_renewal_date = EXCLUDED.next_renewal_date, status = EXCLUDED.status, note = EXCLUDED.note, updated_at = now()
     RETURNING ${memberSimFields}`,
    [sim.id, sim.memberId || null, sim.carrier, sim.phoneNumber || null, sim.simType, sim.planName || null, sim.monthlyFee || 0, sim.dataAmount || null, sim.billingCycleDay, sim.billingCycleType || cycleTypeFromMonths(sim.renewalMonths || 1), sim.renewalMonths || 1, sim.nextRenewalDate || sim.renewalDate || null, sim.renewDay || null, sim.autoRenew !== false, sim.lastTopupDate || null, sim.lastTopupAmount || 0, sim.simBalance || 0, sim.nextRenewalDate || null, sim.status, sim.note || ""]
  );
  return memberSimFromRow(result.rows[0]);
}

export async function ensureUniqueMemberSimPhone(phoneNumber: string, exceptId?: string) {
  const phone = normalizePhoneNumber(phoneNumber);
  if (!phone) return null;
  const result = await pool.query(
    `SELECT id FROM member_sims WHERE regexp_replace(COALESCE(phone_number, ''), '\\D', '', 'g') = $1 AND ($2::uuid IS NULL OR id <> $2::uuid) LIMIT 1`,
    [phone, exceptId || null]
  );
  return result.rows.length ? NextResponse.json({ ok: false, error: "Số này đã tồn tại. Hãy dùng chức năng Đổi gói." }, { status: 409 }) : null;
}

export async function listSimPlanHistory(simId: string) {
  const simRes = await pool.query(`SELECT phone_number FROM member_sims WHERE id = $1`, [simId]);
  const sim = simRes.rows[0];
  if (!sim) return [];

  const phoneDigits = (sim.phone_number || "").replace(/\D/g, "");

  const result = await pool.query(
    `SELECT ${simPlanHistoryFields}
     FROM sim_plan_history
     WHERE regexp_replace(COALESCE(phone_number, ''), '\\D', '', 'g') = $1
     ORDER BY COALESCE(effective_date, make_date(COALESCE(effective_year, 1970), GREATEST(1, COALESCE(effective_month, 1)), 1)) DESC, created_at DESC`,
    [phoneDigits]
  );
  
  const history = result.rows.map(simPlanHistoryFromRow);
  
  // Fallback từ các record member_sims cũ
  const oldSims = await pool.query(
    `SELECT plan_name, monthly_fee, created_at, updated_at
     FROM member_sims
     WHERE regexp_replace(COALESCE(phone_number, ''), '\\D', '', 'g') = $1 AND id != $2
     ORDER BY created_at ASC`,
     [phoneDigits, simId]
  );

  const fallbackHistory = oldSims.rows.map(row => {
    const d = new Date(row.updated_at || row.created_at || Date.now());
    return {
      id: "fallback-" + Math.random().toString(36).substring(7),
      simId,
      phoneNumber: sim.phone_number,
      oldPlanName: "Không xác định",
      oldPlanPrice: 0,
      newPlanName: String(row.plan_name || "Chưa xác định"),
      newPlanPrice: Number(row.monthly_fee || 0),
      effectiveMonth: d.getMonth() + 1,
      effectiveYear: d.getFullYear(),
      effectiveDate: d.toISOString().split("T")[0],
      note: "(Dữ liệu cũ)",
      createdAt: (row.created_at || d).toISOString(),
    };
  });

  return [...history, ...fallbackHistory.reverse()].sort((a, b) => {
    const timeA = new Date(a.effectiveDate || `${a.effectiveYear}-${a.effectiveMonth}-01`).getTime();
    const timeB = new Date(b.effectiveDate || `${b.effectiveYear}-${b.effectiveMonth}-01`).getTime();
    return timeB - timeA;
  });
}

export async function changeMemberSimPlan(input: { simId: string; newPlanName: string; newPlanPrice: number; newBillingCycleType?: string; newRenewalMonths?: number; newRenewDay?: number | null; effectiveMonth: number; effectiveYear: number; effectiveDate?: string; note?: string; actorName?: string }) {
  const current = await pool.query(`SELECT ${memberSimFields} FROM member_sims WHERE id = $1`, [input.simId]);
  const row = current.rows[0];
  if (!row) throw new Error("SIM/Data không tồn tại.");
  const sim = memberSimFromRow(row);
  const newPlanName = String(input.newPlanName || "").trim();
  const newPlanPrice = Number(input.newPlanPrice || 0);
  const newBillingCycleType = normalizeBillingCycleType(input.newBillingCycleType || cycleTypeFromMonths(Number(input.newRenewalMonths || sim.renewalMonths || 1)));
  const newRenewalMonths = newBillingCycleType === "custom" ? Math.max(1, Number(input.newRenewalMonths || sim.renewalMonths || 1)) : monthsFromCycleType(newBillingCycleType);
  const newRenewDay = Number(input.newRenewDay || 0);
  if (!newPlanName) throw new Error("Vui lòng nhập gói mới.");
  const effectiveMonth = Math.min(12, Math.max(1, Number(input.effectiveMonth || new Date().getMonth() + 1)));
  const effectiveYear = Math.max(2000, Number(input.effectiveYear || new Date().getFullYear()));
  const effectiveDate = normalizeIsoDate(input.effectiveDate) || `${effectiveYear}-${String(effectiveMonth).padStart(2, "0")}-01`;

  await pool.query(
    `INSERT INTO sim_plan_history (sim_id, phone_number, old_plan_name, old_plan_price, old_cycle, old_cycle_months, new_plan_name, new_plan_price, new_cycle, new_cycle_months, effective_month, effective_year, effective_date, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [sim.id, sim.phoneNumber || "", sim.planName || "", sim.monthlyFee || 0, sim.billingCycleType || cycleTypeFromMonths(sim.renewalMonths || 1), sim.renewalMonths || 1, newPlanName, newPlanPrice, newBillingCycleType, newRenewalMonths, effectiveMonth, effectiveYear, effectiveDate, input.note || ""]
  );
  const saved = await pool.query(
    `UPDATE member_sims
     SET plan_name = $2, monthly_fee = $3, billing_cycle_type = $4, renewal_months = $5, renew_day = $6, updated_at = now()
     WHERE id = $1
     RETURNING ${memberSimFields}`,
    [sim.id, newPlanName, newPlanPrice, newBillingCycleType, newRenewalMonths, newRenewDay >= 1 && newRenewDay <= 31 ? newRenewDay : sim.renewDay || null]
  );
  await createSimPlanChangedNotification({
    actorName: input.actorName || "Family Hub",
    phoneNumber: sim.phoneNumber || "",
    oldPlanName: sim.planName || "chưa có gói",
    newPlanName,
    simId: sim.id,
  });
  return memberSimFromRow(saved.rows[0]);
}

export async function listSimMonthlyPayments(simId: string, year?: number) {
  const params: unknown[] = [simId];
  const yearFilter = year ? "AND year = $2" : "";
  if (year) params.push(year);
  const result = await pool.query(
    `SELECT ${simMonthlyPaymentFields}
     FROM sim_monthly_payments
     WHERE sim_id = $1 ${yearFilter}
     ORDER BY year DESC, month DESC, updated_at DESC`,
    params
  );
  return result.rows.map(simMonthlyPaymentFromRow);
}

export async function upsertSimMonthlyPayment(input: { simId: string; month: number; year: number; planName: string; amount: number; planFee?: number; billingCycleMonths?: number; coverageStartDate?: string; coverageEndDate?: string; paidDate?: string; status?: string; note?: string; transactionId?: string }) {
  const current = await pool.query(`SELECT ${memberSimFields} FROM member_sims WHERE id = $1`, [input.simId]);
  const row = current.rows[0];
  if (!row) throw new Error("SIM/Data không tồn tại.");
  const sim = memberSimFromRow(row);
  const month = Math.min(12, Math.max(1, Number(input.month || new Date().getMonth() + 1)));
  const year = Math.max(2000, Number(input.year || new Date().getFullYear()));
  const planName = String(input.planName || sim.planName || "").trim();
  const amount = Math.max(0, Number(input.amount || 0));
  const planFee = Math.max(0, Number(input.planFee ?? sim.monthlyFee ?? 0));
  const billingCycleMonths = Math.max(1, Number(input.billingCycleMonths || sim.renewalMonths || 1));
  const paidDate = normalizeIsoDate(input.paidDate) || null;
  const coverageStartDate = normalizeIsoDate(input.coverageStartDate) || paidDate;
  const coverageEndDate = normalizeIsoDate(input.coverageEndDate) || (coverageStartDate ? addDaysToDateOnly(addMonthsToDateOnly(coverageStartDate, billingCycleMonths), -1) : null);
  const status = String(input.status || "paid") === "unpaid" ? "unpaid" : "paid";
  const result = await pool.query(
    `INSERT INTO sim_monthly_payments (sim_id, phone_number, month, year, plan_name, amount, topup_amount, plan_fee, billing_cycle_months, coverage_start_date, coverage_end_date, paid_date, status, note, transaction_id)
     VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (sim_id, year, month) DO UPDATE SET
       phone_number = EXCLUDED.phone_number,
       plan_name = EXCLUDED.plan_name,
       amount = EXCLUDED.amount,
       topup_amount = EXCLUDED.topup_amount,
       plan_fee = EXCLUDED.plan_fee,
       billing_cycle_months = EXCLUDED.billing_cycle_months,
       coverage_start_date = EXCLUDED.coverage_start_date,
       coverage_end_date = EXCLUDED.coverage_end_date,
       paid_date = EXCLUDED.paid_date,
       status = EXCLUDED.status,
       note = EXCLUDED.note,
       transaction_id = COALESCE(EXCLUDED.transaction_id, sim_monthly_payments.transaction_id),
       updated_at = now()
     RETURNING ${simMonthlyPaymentFields}`,
    [sim.id, sim.phoneNumber || "", month, year, planName, amount, planFee, billingCycleMonths, coverageStartDate, coverageEndDate, paidDate, status, input.note || "", input.transactionId || null]
  );
  return simMonthlyPaymentFromRow(result.rows[0]);
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

async function createSimPlanChangedNotification(input: { actorName: string; phoneNumber: string; oldPlanName: string; newPlanName: string; simId: string }) {
  await pool.query(
    `INSERT INTO notifications (title, message, created_by_name, source_type, source_id, metadata, visible_user_ids)
     VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb)`,
    [
      "Cập nhật SIM/Data",
      `${input.actorName} đã đổi gói data số ${input.phoneNumber} từ ${input.oldPlanName} sang ${input.newPlanName}`,
      input.actorName,
      "sim_plan_changed",
      input.simId,
      JSON.stringify({ module: "SIM/Data", type: "sim_plan_changed", phoneNumber: input.phoneNumber }),
    ]
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

function normalizePhoneNumber(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeBillingCycleType(value: unknown) {
  const text = String(value || "").trim();
  return ["monthly", "three_months", "six_months", "yearly", "custom", "one_time", "none"].includes(text) ? text : "monthly";
}

function monthsFromCycleType(value: string) {
  if (value === "three_months") return 3;
  if (value === "six_months") return 6;
  if (value === "yearly") return 12;
  if (value === "one_time" || value === "none") return 1;
  return 1;
}

function cycleTypeFromMonths(months: number) {
  if (months === 3) return "three_months";
  if (months === 6) return "six_months";
  if (months === 12) return "yearly";
  return "monthly";
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
