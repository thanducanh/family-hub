import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { type SessionUser } from "@/lib/auth";
import { canAccessBankMember, ensureBankAccountsTable } from "@/lib/bank-accounts";
import { pool } from "@/lib/db";
import type { BankExtractedPayload, BankRawNote, BankRawNoteContentType } from "@/types";

const fields = "id, member_id, bank_account_id, title, bank_name, content_type, raw_text, image_url, extracted_json, effective_date, expiry_date, note, created_at, updated_at";
const contentTypes: BankRawNoteContentType[] = ["Ưu đãi", "Phí thường niên", "Điều khoản thẻ", "Sao kê", "Email ngân hàng", "Khác"];

export async function ensureBankRawNotesTable() {
  await ensureBankAccountsTable();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_raw_notes (
      id UUID PRIMARY KEY,
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
      title TEXT NOT NULL DEFAULT '',
      bank_name TEXT NOT NULL DEFAULT '',
      content_type TEXT NOT NULL DEFAULT 'Khác',
      raw_text TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      extracted_json JSONB,
      effective_date DATE,
      expiry_date DATE,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_bank_raw_notes_member_id ON bank_raw_notes(member_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_bank_raw_notes_bank_account_id ON bank_raw_notes(bank_account_id)");
  await pool.query("ALTER TABLE bank_raw_notes ADD COLUMN IF NOT EXISTS image_url TEXT");
  await pool.query("ALTER TABLE bank_raw_notes ADD COLUMN IF NOT EXISTS extracted_json JSONB");
}

export function bankRawNotesFromRows(rows: Record<string, unknown>[]) {
  return rows.map(bankRawNoteFromRow);
}

export function bankRawNoteFromRow(row: Record<string, unknown>): BankRawNote {
  return {
    id: String(row.id),
    memberId: String(row.member_id ?? ""),
    bankAccountId: String(row.bank_account_id ?? ""),
    title: String(row.title ?? ""),
    bankName: String(row.bank_name ?? ""),
    contentType: normalizeContentType(row.content_type),
    rawText: String(row.raw_text ?? ""),
    imageUrl: String(row.image_url ?? ""),
    extractedJson: normalizeExtractedJson(row.extracted_json),
    effectiveDate: row.effective_date ? String(row.effective_date).slice(0, 10) : "",
    expiryDate: row.expiry_date ? String(row.expiry_date).slice(0, 10) : "",
    note: String(row.note ?? ""),
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
  };
}

export function normalizeBankRawNoteBody(body: Partial<BankRawNote>) {
  return {
    id: body.id || randomUUID(),
    memberId: String(body.memberId || ""),
    bankAccountId: String(body.bankAccountId || "").trim() || null,
    title: String(body.title || "").trim(),
    bankName: String(body.bankName || "").trim(),
    contentType: normalizeContentType(body.contentType),
    rawText: String(body.rawText || "").trim(),
    imageUrl: String(body.imageUrl || "").trim(),
    extractedJson: body.extractedJson || null,
    effectiveDate: String(body.effectiveDate || "").trim() || null,
    expiryDate: String(body.expiryDate || "").trim() || null,
    note: String(body.note || "").trim(),
  };
}

export async function requireBankRawNoteAccess(user: SessionUser, id: string) {
  const result = await pool.query(`SELECT ${fields} FROM bank_raw_notes WHERE id = $1`, [id]);
  const row = result.rows[0];
  if (!row) return { error: NextResponse.json({ ok: false, error: "Không tìm thấy nội dung gốc ngân hàng." }, { status: 404 }) };
  if (!await canAccessBankMember(user, String(row.member_id))) return { error: NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 }) };
  return { note: bankRawNoteFromRow(row) };
}

export async function upsertBankRawNote(note: ReturnType<typeof normalizeBankRawNoteBody>) {
  const result = await pool.query(
    `INSERT INTO bank_raw_notes (id, member_id, bank_account_id, title, bank_name, content_type, raw_text, image_url, extracted_json, effective_date, expiry_date, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (id) DO UPDATE SET
      member_id=EXCLUDED.member_id,
      bank_account_id=EXCLUDED.bank_account_id,
      title=EXCLUDED.title,
      bank_name=EXCLUDED.bank_name,
      content_type=EXCLUDED.content_type,
      raw_text=EXCLUDED.raw_text,
      image_url=EXCLUDED.image_url,
      extracted_json=EXCLUDED.extracted_json,
      effective_date=EXCLUDED.effective_date,
      expiry_date=EXCLUDED.expiry_date,
      note=EXCLUDED.note,
      updated_at=CURRENT_TIMESTAMP
     RETURNING ${fields}`,
    [note.id, note.memberId, note.bankAccountId, note.title, note.bankName, note.contentType, note.rawText, note.imageUrl, note.extractedJson ? JSON.stringify(note.extractedJson) : null, note.effectiveDate, note.expiryDate, note.note]
  );
  return bankRawNoteFromRow(result.rows[0]);
}

export { fields as bankRawNoteFields };

function normalizeContentType(value: unknown): BankRawNoteContentType {
  return contentTypes.includes(value as BankRawNoteContentType) ? value as BankRawNoteContentType : "Khác";
}

function normalizeExtractedJson(value: unknown): BankExtractedPayload | null {
  if (!value) return null;
  if (typeof value === "object") return value as BankExtractedPayload;
  if (typeof value !== "string") return null;
  try { return JSON.parse(value) as BankExtractedPayload; } catch { return null; }
}
