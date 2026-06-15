import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { canAccessBankMember, ensureBankAccountsTable } from "@/lib/bank-accounts";

function normalizeText(value: any) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function getLast4(card: any) {
  return card.last4 || card.last_four || card.card_last4 || card.account_last4 || "";
}

function transactionText(tx: any) {
  return [
    tx.payment_method,
    tx.payment_account_name,
    tx.bank_account_name,
    tx.card_name,
    tx.linked_account_name,
    tx.note,
    tx.description,
    tx.title
  ].filter(Boolean).join(" ");
}

function isTransactionLinkedToCard(tx: any, card: any) {
  const cardId = String(card.id);
  if (
    String(tx.bank_account_id || "") === cardId ||
    String(tx.payment_account_id || "") === cardId ||
    String(tx.linked_bank_card_id || "") === cardId
  ) {
    return true;
  }

  const text = normalizeText(transactionText(tx));
  const bank = normalizeText(card.bank_name || card.bank || "");
  const last4 = getLast4(card);

  if (last4 && text.includes(last4)) {
    if (!bank || text.includes(bank)) return true;
  }
  return false;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    await ensureBankAccountsTable();

    const { id: cardId } = await params;
    const yearStr = request.nextUrl.searchParams.get("year");
    const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();

    const memberResult = await pool.query("SELECT * FROM bank_accounts WHERE id = $1", [cardId]);
    const accountRow = memberResult.rows[0];
    if (!accountRow) return NextResponse.json({ ok: false, error: "Không tìm thấy thẻ/tài khoản." }, { status: 404 });
    const memberId = accountRow.member_id;
    if (!await canAccessBankMember(user, memberId)) return NextResponse.json({ ok: false, error: "Không có quyền." }, { status: 403 });

    const annualFeeAmount = Number(accountRow.annual_fee_amount || 0);
    const annualFeeWaiverTarget = Number(accountRow.annual_fee_waiver_target || 0);

    const allTxQuerySafe = `
      SELECT 
        id, type, amount, category, title, created_at, date,
        bank_account_id, payment_account_id, payment_method, note
      FROM transactions
      WHERE type = 'expense'
        AND category != 'Tiết kiệm'
        AND category != 'Đầu tư'
        AND EXTRACT(YEAR FROM COALESCE(date, created_at)) = $1
        AND COALESCE(counts_for_card_spending, true) = true
        AND member_id = $2
    `;
    
    const allTx = await pool.query(allTxQuerySafe, [year, memberId]);

    let eligibleSpending = 0;
    let matchedRows = 0;

    for (const tx of allTx.rows) {
      if (isTransactionLinkedToCard(tx, accountRow)) {
        eligibleSpending += Number(tx.amount || 0);
        matchedRows++;
      }
    }

    console.log("[card-stats]", {
      cardId,
      cardName: accountRow.product_name || accountRow.account_type,
      bank: accountRow.bank_name,
      last4: getLast4(accountRow),
      year,
      totalExpenseRows: allTx.rows.length,
      matchedRows,
      eligibleSpending
    });

    const rewardsQuery = `
      SELECT 
        COALESCE(SUM(amount), 0) AS total_amount,
        COALESCE(SUM(points), 0) AS total_points,
        COUNT(*) AS total_count
      FROM card_rewards
      WHERE bank_account_id = $1
        AND EXTRACT(YEAR FROM COALESCE(reward_date, created_at)) = $2
    `;
    const rewardsResult = await pool.query(rewardsQuery, [cardId, year]);
    const rewardAmount = Number(rewardsResult.rows[0]?.total_amount || 0);
    const rewardPoints = Number(rewardsResult.rows[0]?.total_points || 0);
    const rewardsCount = Number(rewardsResult.rows[0]?.total_count || 0);

    const remainingToWaive = annualFeeWaiverTarget > 0 ? Math.max(annualFeeWaiverTarget - eligibleSpending, 0) : 0;
    const isAnnualFeeWaived = annualFeeWaiverTarget > 0 ? eligibleSpending >= annualFeeWaiverTarget : true;
    const waiverProgress = annualFeeWaiverTarget > 0 ? (eligibleSpending / annualFeeWaiverTarget) * 100 : 100;

    return NextResponse.json({
      ok: true,
      data: {
        cardId,
        year,
        eligibleSpending,
        annualFeeWaiverTarget,
        annualFeeAmount,
        remainingToWaive,
        waiverProgress: Math.min(waiverProgress, 100),
        isAnnualFeeWaived,
        rewardAmount,
        rewardPoints,
        rewardsCount
      }
    });

  } catch (error) {
    console.error("[api/bank-accounts/[id]/stats] GET failed", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}
