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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankAccountsTable();

    const { id: rewardId } = await params;
    const body = await request.json();

    const existingResult = await pool.query("SELECT * FROM card_rewards WHERE id = $1", [rewardId]);
    const existing = existingResult.rows[0];
    if (!existing) return NextResponse.json({ ok: false, error: "Không tìm thấy phần thưởng/hoàn tiền." }, { status: 404 });

    if (!await canAccessBankMember(user, existing.member_id)) {
      return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    }

    const type = rewardTypes.includes(body.type) ? body.type as CardRewardType : existing.type;
    const status = rewardStatuses.includes(body.status) ? body.status as CardRewardStatus : existing.status;

    const result = await pool.query(
      `UPDATE card_rewards
       SET reward_date = COALESCE($1, reward_date),
           type = $2,
           amount = $3,
           points = $4,
           status = $5,
           title = $6,
           note = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        body.rewardDate ? String(body.rewardDate).trim() : null,
        type,
        Number(body.amount ?? existing.amount),
        Number(body.points ?? existing.points),
        status,
        body.title !== undefined ? String(body.title).trim() : existing.title,
        body.note !== undefined ? String(body.note).trim() : existing.note,
        rewardId
      ]
    );

    return NextResponse.json({ ok: true, data: rewardFromRow(result.rows[0]) });
  } catch (error) {
    console.error("[api/card-rewards/[id]] PUT failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankAccountsTable();

    const { id: rewardId } = await params;
    const existingResult = await pool.query("SELECT * FROM card_rewards WHERE id = $1", [rewardId]);
    const existing = existingResult.rows[0];
    if (!existing) return NextResponse.json({ ok: false, error: "Không tìm thấy dữ liệu." }, { status: 404 });

    if (!await canAccessBankMember(user, existing.member_id)) {
      return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });
    }

    await pool.query("DELETE FROM card_rewards WHERE id = $1", [rewardId]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/card-rewards/[id]] DELETE failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ." }, { status: 500 });
  }
}
