import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { canAccessBankMember } from "@/lib/bank-accounts";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    
    const bankAccountId = request.nextUrl.searchParams.get("bankAccountId");
    if (!bankAccountId) return NextResponse.json({ ok: false, error: "Thiếu bankAccountId." }, { status: 400 });
    
    // Find the bank account to verify access permissions
    const accountRes = await pool.query("SELECT member_id FROM bank_accounts WHERE id = $1", [bankAccountId]);
    const account = accountRes.rows[0];
    if (!account) return NextResponse.json({ ok: false, error: "Không tìm thấy tài khoản ngân hàng." }, { status: 404 });
    
    if (!await canAccessBankMember(user, String(account.member_id))) {
      return NextResponse.json({ ok: false, error: "Không có quyền truy cập." }, { status: 403 });
    }
    
    const rewards = await pool.query(
      `SELECT id, bank_account_id AS "bankAccountId", reward_type AS "rewardType", title, amount, points, recorded_at AS "recordedAt", note 
       FROM bank_card_rewards WHERE bank_account_id = $1 ORDER BY recorded_at DESC NULLS LAST, created_at DESC`,
      [bankAccountId]
    );
    
    return NextResponse.json({ ok: true, data: rewards.rows });
  } catch (error) {
    console.error("[api/bank-card-rewards] GET failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
