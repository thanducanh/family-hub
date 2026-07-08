import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { bankAccountFields, bankAccountFromRow, bankAccountsFromRows, bankMemberExists, canAccessBankMember, ensureBankAccountsTable, isCreditBankType, normalizeBankBody, upsertBankAccount } from "@/lib/bank-accounts";
import { pool } from "@/lib/db";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function logBankAccountsError(error: unknown, queryName: string) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("[api/bank-accounts] error", {
    queryName,
    message: err.message,
    stack: err.stack,
  });
}

export async function GET(request: NextRequest) {
  let queryName = "init";
  try {
    queryName = "getSessionUser";
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    queryName = "ensureBankAccountsTable";
    await ensureBankAccountsTable();
    
    const id = request.nextUrl.searchParams.get("id");
    if (id) {
      queryName = "selectById";
      const result = await pool.query(`SELECT ${bankAccountFields} FROM bank_accounts WHERE id = $1 LIMIT 1`, [id]);
      const row = result.rows[0];
      if (!row) return NextResponse.json({ ok: false, error: "Không tìm thấy thẻ ngân hàng." }, { status: 404 });
      if (!await canAccessBankMember(user, String(row.member_id))) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
      const [account] = await bankAccountsFromRows([row]);
      account.cardNumber = "";
      account.accountNumber = "";
      return NextResponse.json({ ok: true, data: account });
    }

    const memberId = request.nextUrl.searchParams.get("memberId");
    if (memberId) {
      if (!await canAccessBankMember(user, memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
      queryName = "selectByMemberId";
      const result = await pool.query(`SELECT ${bankAccountFields} FROM bank_accounts WHERE member_id = $1 ORDER BY created_at DESC`, [memberId]);
      return NextResponse.json({ ok: true, data: result.rows.map(row => ({ ...bankAccountFromRow(row), cardNumber: "", accountNumber: "", benefits: [] })) });
    }
    queryName = "buildDataFilter";
    const { buildDataFilter } = await import("@/lib/auth");
    const { where, params } = await buildDataFilter(user, "", 1, "member_id");
    queryName = "selectAllAccessible";
    const result = await pool.query(`SELECT ${bankAccountFields} FROM bank_accounts WHERE ${where} ORDER BY created_at DESC`, params);
    const accounts = await bankAccountsFromRows(result.rows);
    accounts.forEach(a => { a.cardNumber = ""; a.accountNumber = ""; });
    return NextResponse.json({ ok: true, data: accounts });
  } catch (error: any) {
    logBankAccountsError(error, queryName);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let queryName = "init";
  try {
    queryName = "getSessionUser";
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    queryName = "ensureBankAccountsTable";
    await ensureBankAccountsTable();
    queryName = "parseBody";
    const body = await request.json();
    console.log("[api/bank-accounts] POST received body:", body);
    const account = normalizeBankBody(body);
    console.log("[api/bank-accounts] POST normalized account:", account);
    if (!account.memberId || !account.bankName || !account.accountType || !account.status) {
      return NextResponse.json({ ok: false, error: "Vui lòng nhập đủ thông tin cơ bản." }, { status: 400 });
    }
    // Remove last4 requirement since cards are symbolic
    account.last4 = "0000";
    account.cardNumber = "";
    account.accountNumber = "";
    if (account.accountType === "Thẻ tín dụng") {
      if (!account.cardNetwork || account.cardNetwork === "Không áp dụng") return NextResponse.json({ ok: false, error: "Vui lòng chọn tổ chức thẻ." }, { status: 400 });
      if (!account.productName) return NextResponse.json({ ok: false, error: "Vui lòng nhập tên sản phẩm thẻ." }, { status: 400 });
    }
    queryName = "bankMemberExists";
    if (!await bankMemberExists(account.memberId)) return NextResponse.json({ ok: false, error: "Không tìm thấy thành viên." }, { status: 404 });
    if (!await canAccessBankMember(user, account.memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    queryName = "upsertBankAccount";
    const saved = await upsertBankAccount(account);
    console.log("[api/bank-accounts] POST saved to DB successfully:", saved?.id);
    return NextResponse.json({ ok: true, data: saved }, { status: 201 });
  } catch (error: any) {
    logBankAccountsError(error, queryName);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
