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
  note: string;
  status: "pending" | "paid";
  paymentTransactionId: string | null;
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
    note: row.note || "",
    status: row.status,
    paymentTransactionId: row.payment_transaction_id,
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
  };
}

export async function getCardPendingTransactions(bankAccountId: string) {
  const result = await pool.query(
    `SELECT * FROM card_pending_transactions WHERE bank_account_id = $1 ORDER BY date DESC, created_at DESC`,
    [bankAccountId]
  );
  return result.rows.map(fromRow);
}

export async function createCardPendingTransaction(data: Omit<CardPendingTransaction, "id" | "status" | "paymentTransactionId" | "createdAt" | "updatedAt">) {
  const result = await pool.query(
    `INSERT INTO card_pending_transactions (id, member_id, bank_account_id, title, amount, date, category, note, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
     RETURNING *`,
    [randomUUID(), data.memberId, data.bankAccountId, data.title, data.amount, data.date, data.category, data.note]
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
