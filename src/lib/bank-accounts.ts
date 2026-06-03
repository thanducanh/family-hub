import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { type SessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import type { AnnualFeeCycle, AnnualFeeWaiverType, BankAccount, BankAccountStatus, BankCardNetwork, BankCardReward, BankCardRewardType, BankCardType } from "@/types";

const fields = "id, member_id, bank_name, account_holder, account_number, card_number, account_type, card_type, card_network, product_name, branch, statement_day, due_day, credit_limit, expiry_month, expiry_year, status, annual_fee_enabled, annual_fee_amount, annual_fee_waiver_type, annual_fee_waiver_target, annual_fee_cycle, annual_fee_cycle_start, annual_fee_current_spending, note, created_at, updated_at";
const rewardFields = "id, bank_account_id, reward_type, title, amount, points, recorded_at, note, created_at, updated_at";
const cardTypes: BankCardType[] = ["Tài khoản nhận lương", "Tài khoản ngân hàng", "ATM nội địa", "Debit", "Credit Visa", "Credit Mastercard", "Credit JCB", "Ví điện tử"];
const networks: BankCardNetwork[] = ["NAPAS", "Visa", "Mastercard", "JCB", "Khác"];
const statuses: BankAccountStatus[] = ["Đang dùng", "Tạm khóa", "Đã hủy"];
const waiverTypes: AnnualFeeWaiverType[] = ["Không có", "Theo tổng chi tiêu năm", "Theo tổng chi tiêu tháng", "Theo số giao dịch"];
const cycles: AnnualFeeCycle[] = ["tháng", "năm"];
const rewardTypes: BankCardRewardType[] = ["Hoàn tiền", "Đổi điểm thành tiền", "Quà tặng", "Miễn/giảm phí"];

export async function ensureBankAccountsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id UUID PRIMARY KEY,
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      bank_name TEXT NOT NULL DEFAULT '',
      account_holder TEXT NOT NULL DEFAULT '',
      account_number TEXT DEFAULT '',
      card_number TEXT DEFAULT '',
      account_type TEXT NOT NULL DEFAULT 'Tài khoản nhận lương',
      card_type TEXT NOT NULL DEFAULT 'Tài khoản nhận lương',
      card_network TEXT NOT NULL DEFAULT 'NAPAS',
      product_name TEXT NOT NULL DEFAULT '',
      branch TEXT DEFAULT '',
      statement_day TEXT DEFAULT '',
      due_day TEXT DEFAULT '',
      credit_limit NUMERIC DEFAULT 0,
      expiry_month TEXT NOT NULL DEFAULT '',
      expiry_year TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Đang dùng',
      annual_fee_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      annual_fee_amount NUMERIC NOT NULL DEFAULT 0,
      annual_fee_waiver_type TEXT NOT NULL DEFAULT 'Không có',
      annual_fee_waiver_target NUMERIC NOT NULL DEFAULT 0,
      annual_fee_cycle TEXT NOT NULL DEFAULT 'năm',
      annual_fee_cycle_start DATE,
      annual_fee_current_spending NUMERIC NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const alter = [
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'Tài khoản nhận lương'",
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS card_network TEXT NOT NULL DEFAULT 'NAPAS'",
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS product_name TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS statement_day TEXT",
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS due_day TEXT",
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0",
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_enabled BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_amount NUMERIC NOT NULL DEFAULT 0",
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_waiver_type TEXT NOT NULL DEFAULT 'Không có'",
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_waiver_target NUMERIC NOT NULL DEFAULT 0",
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_cycle TEXT NOT NULL DEFAULT 'năm'",
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_cycle_start DATE",
    "ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS annual_fee_current_spending NUMERIC NOT NULL DEFAULT 0",
  ];
  for (const statement of alter) await pool.query(statement);
  for (const column of ["account_number", "card_number", "branch", "statement_day", "due_day", "credit_limit"]) await pool.query(`ALTER TABLE bank_accounts ALTER COLUMN ${column} DROP NOT NULL`);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_bank_accounts_member_id ON bank_accounts(member_id)");

  // Giữ bảng cũ để không mất dữ liệu, nhưng UI/API chính không còn đọc/ghi bảng này.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_card_benefits (
      id UUID PRIMARY KEY,
      bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Khác',
      benefit_type TEXT NOT NULL DEFAULT 'Hoàn tiền %',
      benefit_value NUMERIC NOT NULL DEFAULT 0,
      monthly_cap NUMERIC NOT NULL DEFAULT 0,
      min_transaction_amount NUMERIC NOT NULL DEFAULT 0,
      condition_note TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_bank_card_benefits_bank_account_id ON bank_card_benefits(bank_account_id)");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_card_rewards (
      id UUID PRIMARY KEY,
      bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
      reward_type TEXT NOT NULL DEFAULT 'Hoàn tiền',
      title TEXT NOT NULL DEFAULT '',
      amount NUMERIC NOT NULL DEFAULT 0,
      points NUMERIC NOT NULL DEFAULT 0,
      recorded_at DATE,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_bank_card_rewards_bank_account_id ON bank_card_rewards(bank_account_id)");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS estimated_cashback NUMERIC NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS actual_cashback NUMERIC NOT NULL DEFAULT 0");
}

export async function bankAccountsFromRows(rows: Record<string, unknown>[]) {
  const accounts = rows.map(row => bankAccountFromRow(row));
  if (!accounts.length) return accounts;
  const rewards = await pool.query(`SELECT ${rewardFields} FROM bank_card_rewards WHERE bank_account_id = ANY($1::uuid[]) ORDER BY recorded_at DESC NULLS LAST, created_at DESC`, [accounts.map(account => account.id)]);
  const byAccount = rewards.rows.reduce<Record<string, BankCardReward[]>>((result, row) => {
    const reward = rewardFromRow(row);
    return { ...result, [reward.bankAccountId]: [...(result[reward.bankAccountId] || []), reward] };
  }, {});
  return accounts.map(account => ({ ...account, rewards: byAccount[account.id] || [] }));
}

export function bankAccountFromRow(row: Record<string, unknown>): BankAccount {
  const type = normalizeCardType(row.account_type || row.card_type);
  return {
    id: String(row.id),
    memberId: String(row.member_id ?? ""),
    bankName: String(row.bank_name ?? ""),
    accountHolder: String(row.account_holder ?? ""),
    accountNumber: String(row.account_number ?? ""),
    cardNumber: String(row.card_number ?? ""),
    accountType: type,
    cardType: type,
    cardNetwork: normalizeNetwork(row.card_network),
    productName: String(row.product_name ?? ""),
    branch: String(row.branch ?? ""),
    statementDay: String(row.statement_day ?? ""),
    dueDay: String(row.due_day ?? ""),
    creditLimit: Number(row.credit_limit ?? 0),
    expiryMonth: String(row.expiry_month ?? ""),
    expiryYear: String(row.expiry_year ?? ""),
    status: normalizeStatus(row.status),
    annualFeeEnabled: Boolean(row.annual_fee_enabled),
    annualFeeAmount: Number(row.annual_fee_amount ?? 0),
    annualFeeWaiverType: normalizeWaiverType(row.annual_fee_waiver_type),
    annualFeeWaiverTarget: Number(row.annual_fee_waiver_target ?? 0),
    annualFeeCycle: normalizeCycle(row.annual_fee_cycle),
    annualFeeCycleStart: row.annual_fee_cycle_start ? String(row.annual_fee_cycle_start).slice(0, 10) : "",
    annualFeeCurrentSpending: Number(row.annual_fee_current_spending ?? 0),
    note: String(row.note ?? ""),
    benefits: [],
    rewards: [],
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
  };
}

export async function canAccessBankMember(user: SessionUser, memberId: string) {
  if (user.role === "full_access") return true;
  return Boolean(user.memberId && user.memberId === memberId);
}

export async function requireBankAccountAccess(user: SessionUser, id: string) {
  const result = await pool.query(`SELECT ${fields} FROM bank_accounts WHERE id = $1`, [id]);
  const row = result.rows[0];
  if (!row) return { error: NextResponse.json({ ok: false, error: "Không tìm thấy thẻ ngân hàng." }, { status: 404 }) };
  if (!await canAccessBankMember(user, String(row.member_id))) return { error: NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 }) };
  const [account] = await bankAccountsFromRows([row]);
  return { account };
}

export async function bankMemberExists(memberId: string) {
  const result = await pool.query("SELECT id FROM members WHERE id = $1 AND deleted_at IS NULL", [memberId]);
  return Boolean(result.rows[0]);
}

export function normalizeBankBody(body: Partial<BankAccount>) {
  return {
    id: body.id || randomUUID(),
    memberId: String(body.memberId || ""),
    bankName: String(body.bankName || "").trim(),
    accountHolder: String(body.accountHolder || "").trim(),
    accountNumber: String(body.accountNumber || "").trim(),
    cardNumber: String(body.cardNumber || "").trim(),
    accountType: normalizeCardType(body.accountType || body.cardType),
    cardType: normalizeCardType(body.accountType || body.cardType),
    cardNetwork: normalizeNetwork(body.cardNetwork),
    productName: String(body.productName || "").trim(),
    branch: String(body.branch || "").trim(),
    statementDay: String(body.statementDay || "").trim(),
    dueDay: String(body.dueDay || "").trim(),
    creditLimit: Number(body.creditLimit || 0),
    expiryMonth: String(body.expiryMonth || "").trim(),
    expiryYear: String(body.expiryYear || "").trim(),
    status: normalizeStatus(body.status),
    annualFeeEnabled: Boolean(body.annualFeeEnabled),
    annualFeeAmount: Number(body.annualFeeAmount || 0),
    annualFeeWaiverType: normalizeWaiverType(body.annualFeeWaiverType),
    annualFeeWaiverTarget: Number(body.annualFeeWaiverTarget || 0),
    annualFeeCycle: normalizeCycle(body.annualFeeCycle),
    annualFeeCycleStart: String(body.annualFeeCycleStart || "").trim() || null,
    annualFeeCurrentSpending: Number(body.annualFeeCurrentSpending || 0),
    note: String(body.note || "").trim(),
    rewards: (body.rewards || []).map(normalizeRewardBody),
  };
}

export function isCreditBankType(value: unknown) {
  return ["Credit Visa", "Credit Mastercard", "Credit JCB"].includes(String(value));
}

export async function upsertBankAccount(account: ReturnType<typeof normalizeBankBody>) {
  const result = await pool.query(
    `INSERT INTO bank_accounts (id, member_id, bank_name, account_holder, account_number, card_number, account_type, card_type, card_network, product_name, branch, statement_day, due_day, credit_limit, expiry_month, expiry_year, status, annual_fee_enabled, annual_fee_amount, annual_fee_waiver_type, annual_fee_waiver_target, annual_fee_cycle, annual_fee_cycle_start, annual_fee_current_spending, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
     ON CONFLICT (id) DO UPDATE SET
      member_id=EXCLUDED.member_id,
      bank_name=EXCLUDED.bank_name,
      account_holder=EXCLUDED.account_holder,
      account_number=EXCLUDED.account_number,
      card_number=EXCLUDED.card_number,
      account_type=EXCLUDED.account_type,
      card_type=EXCLUDED.card_type,
      card_network=EXCLUDED.card_network,
      product_name=EXCLUDED.product_name,
      branch=EXCLUDED.branch,
      statement_day=EXCLUDED.statement_day,
      due_day=EXCLUDED.due_day,
      credit_limit=EXCLUDED.credit_limit,
      expiry_month=EXCLUDED.expiry_month,
      expiry_year=EXCLUDED.expiry_year,
      status=EXCLUDED.status,
      annual_fee_enabled=EXCLUDED.annual_fee_enabled,
      annual_fee_amount=EXCLUDED.annual_fee_amount,
      annual_fee_waiver_type=EXCLUDED.annual_fee_waiver_type,
      annual_fee_waiver_target=EXCLUDED.annual_fee_waiver_target,
      annual_fee_cycle=EXCLUDED.annual_fee_cycle,
      annual_fee_cycle_start=EXCLUDED.annual_fee_cycle_start,
      annual_fee_current_spending=EXCLUDED.annual_fee_current_spending,
      note=EXCLUDED.note,
      updated_at=CURRENT_TIMESTAMP
     RETURNING ${fields}`,
    [account.id, account.memberId, account.bankName, account.accountHolder, account.accountNumber, account.cardNumber, account.accountType, account.cardType, account.cardNetwork, account.productName, account.branch, account.statementDay, account.dueDay, account.creditLimit, account.expiryMonth, account.expiryYear, account.status, account.annualFeeEnabled, account.annualFeeAmount, account.annualFeeWaiverType, account.annualFeeWaiverTarget, account.annualFeeCycle, account.annualFeeCycleStart, account.annualFeeCurrentSpending, account.note]
  );
  await pool.query("DELETE FROM bank_card_rewards WHERE bank_account_id = $1", [account.id]);
  for (const reward of account.rewards) await insertReward(account.id, reward);
  const [saved] = await bankAccountsFromRows(result.rows);
  return saved;
}

export { fields as bankAccountFields };

function rewardFromRow(row: Record<string, unknown>): BankCardReward {
  return {
    id: String(row.id),
    bankAccountId: String(row.bank_account_id),
    rewardType: normalizeRewardType(row.reward_type),
    title: String(row.title ?? ""),
    amount: Number(row.amount ?? 0),
    points: Number(row.points ?? 0),
    recordedAt: row.recorded_at ? String(row.recorded_at).slice(0, 10) : "",
    note: String(row.note ?? ""),
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
  };
}

function normalizeRewardBody(body: Partial<BankCardReward>): BankCardReward {
  return {
    id: body.id || randomUUID(),
    bankAccountId: String(body.bankAccountId || ""),
    rewardType: normalizeRewardType(body.rewardType),
    title: String(body.title || "").trim(),
    amount: Number(body.amount || 0),
    points: Number(body.points || 0),
    recordedAt: String(body.recordedAt || "").trim(),
    note: String(body.note || "").trim(),
  };
}

async function insertReward(bankAccountId: string, reward: BankCardReward) {
  await pool.query(
    `INSERT INTO bank_card_rewards (id, bank_account_id, reward_type, title, amount, points, recorded_at, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [reward.id || randomUUID(), bankAccountId, reward.rewardType, reward.title, reward.amount, reward.points, reward.recordedAt || null, reward.note]
  );
}

function normalizeCardType(value: unknown): BankCardType {
  return cardTypes.includes(value as BankCardType) ? value as BankCardType : "Tài khoản nhận lương";
}
function normalizeNetwork(value: unknown): BankCardNetwork {
  return networks.includes(value as BankCardNetwork) ? value as BankCardNetwork : "NAPAS";
}
function normalizeStatus(value: unknown): BankAccountStatus {
  return statuses.includes(value as BankAccountStatus) ? value as BankAccountStatus : "Đang dùng";
}
function normalizeWaiverType(value: unknown): AnnualFeeWaiverType {
  return waiverTypes.includes(value as AnnualFeeWaiverType) ? value as AnnualFeeWaiverType : "Không có";
}
function normalizeCycle(value: unknown): AnnualFeeCycle {
  return cycles.includes(value as AnnualFeeCycle) ? value as AnnualFeeCycle : "năm";
}
function normalizeRewardType(value: unknown): BankCardRewardType {
  return rewardTypes.includes(value as BankCardRewardType) ? value as BankCardRewardType : "Hoàn tiền";
}
