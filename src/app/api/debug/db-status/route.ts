import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const rawUrl = process.env.DATABASE_URL || "";
    let hostMasked = "unknown";
    let databaseName = "unknown";
    let userName = "unknown";

    try {
      if (rawUrl) {
        const url = new URL(rawUrl);
        hostMasked = url.hostname;
        databaseName = url.pathname.replace("/", "");
        userName = url.username;
      }
    } catch (e) {
      hostMasked = "invalid_url";
    }

    const bankQuery = await pool.query(`SELECT COUNT(*) as count FROM bank_accounts`);
    const pendingQuery = await pool.query(`SELECT COUNT(*) as count FROM card_pending_transactions`);
    const txQuery = await pool.query(`SELECT COUNT(*) as count FROM transactions`);
    const tx0708Query = await pool.query(`SELECT COUNT(*) as count FROM transactions WHERE date = '2026-07-08'`);

    const latestTxQuery = await pool.query(`SELECT date, title FROM transactions ORDER BY created_at DESC LIMIT 1`);
    const latestPendingQuery = await pool.query(`SELECT title, amount FROM card_pending_transactions ORDER BY created_at DESC LIMIT 1`);

    const creditCardsQuery = await pool.query(`
      SELECT bank_name, product_name, display_name, card_type, status, due_day 
      FROM bank_accounts 
      WHERE LOWER(COALESCE(card_type, '')) IN ('credit', 'credit_card', 'the tin dung', 'thẻ tín dụng') 
         OR LOWER(COALESCE(account_type, '')) IN ('credit', 'credit_card', 'the tin dung', 'thẻ tín dụng')
    `);

    const pendingListQuery = await pool.query(`
      SELECT t.title, t.amount, t.date, t.status, b.name as card_name
      FROM card_pending_transactions t
      LEFT JOIN bank_accounts b ON t.bank_account_id = b.id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    return NextResponse.json({
      ok: true,
      database: {
        hostMasked,
        databaseName,
        userName,
        nodeEnv: process.env.NODE_ENV
      },
      counts: {
        bankAccounts: Number(bankQuery.rows[0]?.count || 0),
        pendingCardTransactions: Number(pendingQuery.rows[0]?.count || 0),
        transactions: Number(txQuery.rows[0]?.count || 0),
        transactionsOn20260708: Number(tx0708Query.rows[0]?.count || 0)
      },
      latest: {
        latestTransactionDate: latestTxQuery.rows[0]?.date || null,
        latestTransactionTitle: latestTxQuery.rows[0]?.title || null,
        latestPendingTitle: latestPendingQuery.rows[0]?.title || null,
        latestPendingAmount: latestPendingQuery.rows[0]?.amount || null
      },
      creditCards: creditCardsQuery.rows.map(r => ({
        bankName: r.bank_name,
        productName: r.product_name,
        displayName: r.display_name,
        cardType: r.card_type,
        status: r.status,
        dueDay: r.due_day
      })),
      pendingCards: pendingListQuery.rows.map(r => ({
        title: r.title,
        amount: r.amount,
        date: r.date,
        status: r.status,
        cardName: r.card_name
      }))
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
