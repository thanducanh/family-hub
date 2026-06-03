import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { bankAccountFields, bankAccountsFromRows, bankMemberExists, canAccessBankMember, ensureBankAccountsTable, isCreditBankType, normalizeBankBody, requireBankAccountAccess, upsertBankAccount } from "@/lib/bank-accounts";
import { bankRawNotesFromRows } from "@/lib/bank-raw-notes";
import { pool } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    const { id } = await params;
    if (!id || id === "undefined") return NextResponse.json({ ok: false, error: "Không tìm thấy thẻ ngân hàng." }, { status: 404 });
    const accountResult = await pool.query(`SELECT ${bankAccountFields} FROM bank_accounts WHERE id = $1 LIMIT 1`, [id]);
    if (!accountResult.rows[0]) return NextResponse.json({ ok: false, error: "Không tìm thấy thẻ ngân hàng." }, { status: 404 });
    if (!await canAccessBankMember(user, String(accountResult.rows[0].member_id))) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const [account] = await bankAccountsFromRows([accountResult.rows[0]]);
    const [memberResult, rawNotesResult] = await Promise.all([
      pool.query("SELECT id, name, nickname, birthday, gender, role, phone, avatar, notes, color FROM members WHERE id = $1 AND deleted_at IS NULL", [account.memberId]),
      pool.query("SELECT id, member_id, bank_account_id, title, bank_name, content_type, LEFT(raw_text, 1200) AS raw_text, image_url, extracted_json, effective_date, expiry_date, note, created_at, updated_at FROM bank_raw_notes WHERE bank_account_id = $1 ORDER BY updated_at DESC LIMIT 10", [id]).catch(() => ({ rows: [] })),
    ]);
    return NextResponse.json({ ok: true, data: account, member: memberResult.rows[0] || null, rawNotes: bankRawNotesFromRows(rawNotesResult.rows) });
  } catch (error) {
    console.error("[api/bank-accounts/:id] GET failed", error);
    return NextResponse.json({ ok: false, error: "Không tải được thông tin thẻ." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankAccountsTable();
    const { id } = await params;
    const existing = await requireBankAccountAccess(user, id);
    if (existing.error) return existing.error;
    const body = await request.json();
    const account = normalizeBankBody({ ...body, id });
    const missingNumber = !isCreditBankType(account.cardType) && !account.accountNumber && !account.cardNumber;
    if (!account.memberId || !account.bankName || !account.accountHolder || missingNumber) return NextResponse.json({ ok: false, error: "Vui lòng nhập đủ thông tin ngân hàng." }, { status: 400 });
    if (!await bankMemberExists(account.memberId)) return NextResponse.json({ ok: false, error: "Không tìm thấy thành viên." }, { status: 404 });
    if (!await canAccessBankMember(user, account.memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const saved = await upsertBankAccount(account);
    return NextResponse.json({ ok: true, data: saved });
  } catch (error) {
    console.error("[api/bank-accounts/:id] PUT failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankAccountsTable();
    const { id } = await params;
    const existing = await requireBankAccountAccess(user, id);
    if (existing.error) return existing.error;
    await pool.query("DELETE FROM bank_accounts WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/bank-accounts/:id] DELETE failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
