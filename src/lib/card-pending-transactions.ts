import { pool } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { canAccessBankMember } from "@/lib/bank-accounts";
import type { SessionUser } from "@/lib/auth";

export interface CardPendingTransaction {
  id: string;
  memberId: string;
  bankAccountId: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  subcategory?: string;
  note: string;
  status: "pending" | "paid";
  paymentTransactionId: string | null;
  bankName?: string;
  productName?: string;
  displayName?: string;
  cardType?: string;
  bank_name?: string;
  product_name?: string;
  display_name?: string;
  card_type?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function ensureCardPendingTransactionsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS card_pending_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      date DATE NOT NULL,
      category VARCHAR(128) NOT NULL DEFAULT 'Khác',
      note TEXT,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      payment_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_card_pending_tx_member_id ON card_pending_transactions(member_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_card_pending_tx_bank_account_id ON card_pending_transactions(bank_account_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_card_pending_tx_status ON card_pending_transactions(status)`);
  for (const statement of [
    "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS member_id UUID",
    "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID",
    "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC NOT NULL DEFAULT 0",
    "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE",
    "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS category VARCHAR(128) NOT NULL DEFAULT 'Khác'",
    "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS subcategory TEXT",
    "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS note TEXT",
    "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'pending'",
    "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS payment_transaction_id UUID",
    "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE card_pending_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP"
  ]) await pool.query(statement);
}

function fromRow(row: any): CardPendingTransaction {
  return {
    id: row.id,
    memberId: row.member_id,
    bankAccountId: row.bank_account_id,
    title: row.title,
    amount: Number(row.amount),
    date: row.date ? String(row.date).slice(0, 10) : "",
    category: row.category,
    subcategory: row.subcategory || "",
    note: row.note || "",
    status: row.status,
    paymentTransactionId: row.payment_transaction_id,
    bankName: row.bank_name || "",
    productName: row.product_name || "",
    displayName: row.display_name || "",
    cardType: row.card_type || "",
    bank_name: row.bank_name || "",
    product_name: row.product_name || "",
    display_name: row.display_name || "",
    card_type: row.card_type || "",
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
  };
}

export async function getCardPendingTransactions(bankAccountId: string) {
  const result = await pool.query(
    `SELECT cpt.*, ba.bank_name, ba.product_name, ba.display_name, ba.card_type
     FROM card_pending_transactions cpt
     LEFT JOIN bank_accounts ba ON ba.id = cpt.bank_account_id
     WHERE cpt.bank_account_id = $1
     ORDER BY cpt.date DESC, cpt.created_at DESC`,
    [bankAccountId]
  );
  return result.rows.map(fromRow);
}

export async function createCardPendingTransaction(data: Omit<CardPendingTransaction, "id" | "status" | "paymentTransactionId" | "createdAt" | "updatedAt">) {
  const duplicate = await pool.query(
    `SELECT *
     FROM card_pending_transactions
     WHERE member_id = $1
       AND bank_account_id = $2
       AND title = $3
       AND amount = $4
       AND category = $5
       AND COALESCE(subcategory, '') = $6
       AND date = $7::date
       AND status = 'pending'
       AND created_at >= CURRENT_TIMESTAMP - INTERVAL '5 seconds'
     ORDER BY created_at DESC
     LIMIT 1`,
    [data.memberId, data.bankAccountId, data.title, data.amount, data.category, data.subcategory || "", data.date]
  );
  if (duplicate.rows[0]) return fromRow(duplicate.rows[0]);

  const result = await pool.query(
    `INSERT INTO card_pending_transactions (id, member_id, bank_account_id, title, amount, date, category, subcategory, note, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
     RETURNING *`,
    [randomUUID(), data.memberId, data.bankAccountId, data.title, data.amount, data.date, data.category, data.subcategory || "", data.note]
  );
  return fromRow(result.rows[0]);
}

export async function updateCardPendingTransaction(id: string, data: Partial<CardPendingTransaction>) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (data.title !== undefined) { fields.push(`title = $${idx++}`); values.push(data.title); }
  if (data.amount !== undefined) { fields.push(`amount = $${idx++}`); values.push(data.amount); }
  if (data.date !== undefined) { fields.push(`date = $${idx++}`); values.push(data.date); }
  if (data.category !== undefined) { fields.push(`category = $${idx++}`); values.push(data.category); }
  if (data.note !== undefined) { fields.push(`note = $${idx++}`); values.push(data.note); }
  
  if (fields.length === 0) return null;

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await pool.query(
    `UPDATE card_pending_transactions SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
}

export async function deleteCardPendingTransaction(id: string) {
  await pool.query(`DELETE FROM card_pending_transactions WHERE id = $1`, [id]);
}

export async function requireCardPendingTransactionAccess(user: SessionUser, id: string) {
  const result = await pool.query(`SELECT * FROM card_pending_transactions WHERE id = $1`, [id]);
  const row = result.rows[0];
  if (!row) return { error: NextResponse.json({ ok: false, error: "Không tìm thấy giao dịch." }, { status: 404 }) };
  if (!await canAccessBankMember(user, String(row.member_id))) return { error: NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 }) };
  return { transaction: fromRow(row) };
}
