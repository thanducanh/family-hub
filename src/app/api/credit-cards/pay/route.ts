import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser, buildDataFilter } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { cardId, sourceId, paymentDate } = await req.json();

    if (!cardId || !sourceId || !paymentDate) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const filter = await buildDataFilter(user, 'member_id', 2, 'member_id', 'finance');
    
    // Validate source account
    const sourceQuery = await pool.query(`
      SELECT id, name, card_type
      FROM bank_accounts
      WHERE id = $1 AND ${filter.where}
    `, [sourceId, ...filter.params]);

    if (sourceQuery.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Source account not found" }, { status: 404 });
    }

    const sourceAccount = sourceQuery.rows[0];
    if (sourceAccount.card_type === 'credit' || sourceAccount.card_type === 'Thẻ tín dụng') {
      return NextResponse.json({ ok: false, error: "Không thể dùng thẻ tín dụng để thanh toán thẻ tín dụng." }, { status: 400 });
    }

    // Get the credit card to pay
    const cardQuery = await pool.query(`
      SELECT id, name, member_id
      FROM bank_accounts
      WHERE id = $1 AND ${filter.where}
    `, [cardId, ...filter.params]);

    if (cardQuery.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Credit card not found" }, { status: 404 });
    }
    const card = cardQuery.rows[0];

    // Get pending transactions for this card
    const pendingQuery = await pool.query(`
      SELECT id, amount
      FROM card_pending_transactions
      WHERE bank_account_id = $1 AND status = 'pending' AND ${filter.where}
    `, [cardId, ...filter.params]);

    const pendingTransactions = pendingQuery.rows;
    if (pendingTransactions.length === 0) {
      return NextResponse.json({ ok: false, error: "Thẻ này chưa có khoản tạm tính cần thanh toán." }, { status: 400 });
    }

    const totalAmount = pendingTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const dateObj = new Date(paymentDate);
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    const title = `Thanh toán thẻ ${card.name} - Tháng ${mm}/${yyyy}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create a real transaction
      const insertTxQuery = await client.query(`
        INSERT INTO transactions (
          type, amount, date, title, category, subcategory, member_id, bank_account_id, note
        ) VALUES (
          'expense', $1, $2, $3, 'Thanh toán thẻ', $4, $5, $6, 'Thanh toán dư nợ thẻ tín dụng'
        ) RETURNING id
      `, [totalAmount, paymentDate, title, card.name, card.member_id, sourceId]);

      const paymentTxId = insertTxQuery.rows[0].id;

      // 2. Update pending transactions to 'paid' and link them
      const pendingIds = pendingTransactions.map(p => p.id);
      await client.query(`
        UPDATE card_pending_transactions
        SET status = 'paid', payment_transaction_id = $1
        WHERE id = ANY($2::uuid[])
      `, [paymentTxId, pendingIds]);

      await client.query('COMMIT');

      return NextResponse.json({
        ok: true,
        data: {
          transactionId: paymentTxId,
          totalAmount
        }
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("[POST /api/credit-cards/pay]", error);
    return NextResponse.json({ ok: false, error: "Không thể thanh toán thẻ." }, { status: 500 });
  }
}
