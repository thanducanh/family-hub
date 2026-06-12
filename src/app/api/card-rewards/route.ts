import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessBankMember, ensureBankAccountsTable } from "@/lib/bank-accounts";
import { pool } from "@/lib/db";
import type { CardRewardStatus, CardRewardType } from "@/types";

const rewardTypes: CardRewardType[] = ["cashback", "points", "redeem_points", "voucher", "annual_fee_refund", "other"];
const rewardStatuses: CardRewardStatus[] = ["expected", "received", "used", "expired"];

function rewardFromRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    memberId: String(row.member_id || ""),
    bankAccountId: row.bank_account_id ? String(row.bank_account_id) : null,
    rewardDate: row.reward_date ? String(row.reward_date).slice(0, 10) : "",
    type: rewardTypes.includes(row.type as CardRewardType) ? row.type as CardRewardType : "cashback",
    amount: Number(row.amount || 0),
    points: Number(row.points || 0),
    status: rewardStatuses.includes(row.status as CardRewardStatus) ? row.status as CardRewardStatus : "expected",
    title: String(row.title || ""),
    note: String(row.note || ""),
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
  };
}

async function memberForBankAccount(bankAccountId: string) {
  const result = await pool.query("SELECT member_id FROM bank_accounts WHERE id = $1", [bankAccountId]);
  return result.rows[0]?.member_id ? String(result.rows[0].member_id) : "";
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankAccountsTable();

    const bankAccountId = request.nextUrl.searchParams.get("bankAccountId") || "";
    const memberId = request.nextUrl.searchParams.get("memberId") || "";
    const accessMemberId = bankAccountId ? await memberForBankAccount(bankAccountId) : memberId;
    if (!accessMemberId) return NextResponse.json({ ok: false, error: "Thiếu thông tin thẻ hoặc thành viên." }, { status: 400 });
    if (!await canAccessBankMember(user, accessMemberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });

    const result = bankAccountId
      ? await pool.query("SELECT * FROM card_rewards WHERE bank_account_id = $1 ORDER BY reward_date DESC NULLS LAST, created_at DESC", [bankAccountId])
      : await pool.query("SELECT * FROM card_rewards WHERE member_id = $1 ORDER BY reward_date DESC NULLS LAST, created_at DESC", [memberId]);
    return NextResponse.json({ ok: true, data: result.rows.map(rewardFromRow) });
  } catch (error) {
    console.error("[api/card-rewards] GET failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankAccountsTable();

    const body = await request.json();
    const bankAccountId = String(body.bankAccountId || "").trim();
    const memberId = bankAccountId ? await memberForBankAccount(bankAccountId) : String(body.memberId || "").trim();
    if (!memberId) return NextResponse.json({ ok: false, error: "Thiếu thành viên." }, { status: 400 });
    if (!await canAccessBankMember(user, memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });

    const type = rewardTypes.includes(body.type) ? body.type as CardRewardType : "cashback";
    const status = rewardStatuses.includes(body.status) ? body.status as CardRewardStatus : "expected";
    const result = await pool.query(
      `INSERT INTO card_rewards (id, member_id, bank_account_id, reward_date, type, amount, points, status, title, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        body.id || randomUUID(),
        memberId,
        bankAccountId || null,
        String(body.rewardDate || "").trim() || null,
        type,
        Number(body.amount || 0),
        Number(body.points || 0),
        status,
        String(body.title || "").trim(),
        String(body.note || "").trim(),
      ]
    );
    return NextResponse.json({ ok: true, data: rewardFromRow(result.rows[0]) }, { status: 201 });
  } catch (error) {
    console.error("[api/card-rewards] POST failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
