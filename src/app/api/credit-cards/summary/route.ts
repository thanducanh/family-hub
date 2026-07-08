import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser, buildDataFilter } from "@/lib/auth";
import { ensureBankAccountsTable } from "@/lib/bank-accounts";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    await ensureBankAccountsTable();
    const filter = await buildDataFilter(user, "", 1, "member_id", "finance");

    const cardsQuery = await pool.query(`
      SELECT id,
             COALESCE(NULLIF(display_name, ''), NULLIF(product_name, ''), NULLIF(bank_name, ''), 'The tin dung') as name,
             bank_name,
             product_name,
             card_type,
             account_type,
             credit_limit,
             due_day as due_date,
             member_id
      FROM bank_accounts
      WHERE (
          LOWER(COALESCE(card_type, '')) IN ('credit', 'credit_card', 'the tin dung', 'thẻ tín dụng')
          OR LOWER(COALESCE(account_type, '')) IN ('credit', 'credit_card', 'the tin dung', 'thẻ tín dụng')
        )
        AND LOWER(COALESCE(status, '')) IN ('active', 'dang dung', 'đang dùng')
        AND ${filter.where}
      ORDER BY bank_name, product_name, display_name
    `, filter.params);

    const pendingQuery = await pool.query(`
      SELECT id, title, amount, date, category, note, bank_account_id, member_id
      FROM card_pending_transactions
      WHERE status = 'pending'
        AND ${filter.where}
      ORDER BY date DESC, created_at DESC
    `, filter.params);

    let pendingCreditTotal = 0;
    const cards = cardsQuery.rows.map(card => {
      const pendingTransactions = pendingQuery.rows
        .filter(p => String(p.bank_account_id) === String(card.id))
        .map(p => ({
          id: p.id,
          title: p.title,
          description: p.title || p.note || p.category || "Giao dich",
          amount: Number(p.amount || 0),
          date: p.date ? String(p.date).slice(0, 10) : "",
          category: p.category,
          note: p.note || "",
          bankAccountId: p.bank_account_id,
          memberId: p.member_id,
        }));
      const pendingTotal = pendingTransactions.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      pendingCreditTotal += pendingTotal;
      return { ...card, pendingTotal, pendingTransactions };
    });

    return NextResponse.json({
      ok: true,
      data: {
        cards,
        pendingCreditTotal
      }
    });

  } catch (error) {
    console.error("[GET /api/credit-cards/summary]", error);
    return NextResponse.json({ ok: false, error: "Khong the tai du lieu the tin dung." }, { status: 500 });
  }
}
