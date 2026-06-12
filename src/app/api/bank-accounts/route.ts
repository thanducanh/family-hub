import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { bankAccountFields, bankAccountFromRow, bankAccountsFromRows, bankMemberExists, canAccessBankMember, ensureBankAccountsTable, isCreditBankType, normalizeBankBody, upsertBankAccount } from "@/lib/bank-accounts";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankAccountsTable();
    
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      const result = await pool.query(`SELECT ${bankAccountFields} FROM bank_accounts WHERE id = $1 LIMIT 1`, [id]);
      const row = result.rows[0];
      if (!row) return NextResponse.json({ ok: false, error: "Không tìm thấy thẻ ngân hàng." }, { status: 404 });
      if (!await canAccessBankMember(user, String(row.member_id))) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
      const [account] = await bankAccountsFromRows([row]);
      return NextResponse.json({ ok: true, data: account });
    }

    const memberId = request.nextUrl.searchParams.get("memberId");
    if (memberId) {
      if (!await canAccessBankMember(user, memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
      const result = await pool.query(`SELECT ${bankAccountFields} FROM bank_accounts WHERE member_id = $1 ORDER BY created_at DESC`, [memberId]);
      return NextResponse.json({ ok: true, data: result.rows.map(row => ({ ...bankAccountFromRow(row), benefits: [] })) });
    }
    const result = user.role === "full_access"
      ? await pool.query(`SELECT ${bankAccountFields} FROM bank_accounts ORDER BY created_at DESC`)
      : await pool.query(`SELECT ${bankAccountFields} FROM bank_accounts WHERE member_id = $1 ORDER BY created_at DESC`, [user.memberId || "00000000-0000-0000-0000-000000000000"]);
    return NextResponse.json({ ok: true, data: await bankAccountsFromRows(result.rows) });
  } catch (error) {
    console.error("[api/bank-accounts] GET failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankAccountsTable();
    const account = normalizeBankBody(await request.json());
    if (!account.memberId || !account.bankName || !account.accountType || !account.accountHolder || !account.status) {
      return NextResponse.json({ ok: false, error: "Vui lòng nhập đủ thông tin cơ bản." }, { status: 400 });
    }
    if (account.accountType !== "Ví điện tử" && !/^\d{4}$/.test(account.last4)) {
      return NextResponse.json({ ok: false, error: "Vui lòng nhập đúng 4 số cuối." }, { status: 400 });
    }
    if (account.accountType === "Ví điện tử" && !account.last4) {
      return NextResponse.json({ ok: false, error: "Vui lòng nhập số điện thoại hoặc 4 số cuối." }, { status: 400 });
    }
    if (account.accountType === "Thẻ tín dụng") {
      if (!account.cardNetwork || account.cardNetwork === "Không áp dụng") return NextResponse.json({ ok: false, error: "Vui lòng chọn tổ chức thẻ." }, { status: 400 });
      if (!account.productName) return NextResponse.json({ ok: false, error: "Vui lòng nhập tên sản phẩm thẻ." }, { status: 400 });
    }
    if (!await bankMemberExists(account.memberId)) return NextResponse.json({ ok: false, error: "Không tìm thấy thành viên." }, { status: 404 });
    if (!await canAccessBankMember(user, account.memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    const saved = await upsertBankAccount(account);
    return NextResponse.json({ ok: true, data: saved }, { status: 201 });
  } catch (error) {
    console.error("[api/bank-accounts] POST failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
