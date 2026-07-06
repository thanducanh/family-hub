import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { requireBankAccountAccess } from "@/lib/bank-accounts";
import { pool } from "@/lib/db";
import { randomUUID } from "node:crypto";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const access = await requireBankAccountAccess(user, id);
  if (access.error) return access.error;

  const body = await request.json();
  const paymentMethod = body.paymentMethod || "transfer"; // e.g. 'cash', 'transfer', 'momo', etc.
  const paymentAccountId = body.paymentAccountId || null;
  const paymentDate = body.date || new Date().toISOString().slice(0, 10);
  
  // NOTE: In the future, we can support txIds to pay specific items. 
  // Currently we just pay ALL pending transactions for this card.

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get all pending transactions for this card
    const pendingResult = await client.query(
      `SELECT * FROM card_pending_transactions WHERE bank_account_id = $1 AND status = 'pending'`,
      [id]
    );

    if (pendingResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Không tìm thấy giao dịch chờ thanh toán hợp lệ." }, { status: 400 });
    }

    const totalAmount = pendingResult.rows.reduce((sum, row) => sum + Number(row.amount), 0);
    const dateStr = body.date || new Date().toISOString().slice(0, 10);
    const month = dateStr.slice(5, 7);
    const year = dateStr.slice(0, 4);

    // Create 1 real transaction
    const paymentTxId = randomUUID();
    await client.query(
      `INSERT INTO transactions (id, member_id, bank_account_id, payment_account_id, payment_method, title, amount, date, category, type, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Thanh toán thẻ', 'expense', $9)`,
      [
        paymentTxId,
        access.account.memberId,
        id,
        paymentAccountId, // Can be null if paid by cash
        paymentMethod,
        `Thanh toán thẻ ${access.account.productName || access.account.bankName} - Tháng ${month}/${year}`,
        totalAmount,
        dateStr,
        `Thanh toán tổng cộng ${pendingResult.rows.length} khoản chi tiêu thẻ.`
      ]
    );

    // Update pending transactions
    await client.query(
      `UPDATE card_pending_transactions SET status = 'paid', payment_transaction_id = $1, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2::uuid[])`,
      [paymentTxId, pendingResult.rows.map(r => r.id)]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, data: { paymentTransactionId: paymentTxId, totalAmount } });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Card payment failed", err);
    return NextResponse.json({ ok: false, error: "Thanh toán thất bại." }, { status: 500 });
  } finally {
    client.release();
  }
}
