import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { canAccessBankMember } from "@/lib/bank-accounts";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // For dashboard, we want to fetch all pending transactions that the user has access to.
  // To simplify, we get all card_pending_transactions and filter by access.
  const result = await pool.query(
    `SELECT * FROM card_pending_transactions WHERE status = 'pending' ORDER BY date DESC, created_at DESC`
  );
  
  const accessible = [];
  const cache = new Map<string, boolean>();
  for (const row of result.rows) {
    const memberId = String(row.member_id);
    if (!cache.has(memberId)) {
      cache.set(memberId, await canAccessBankMember(user, memberId));
    }
    if (cache.get(memberId)) {
      accessible.push({
        id: row.id,
        memberId: row.member_id,
        bankAccountId: row.bank_account_id,
        title: row.title,
        amount: Number(row.amount),
        date: row.date ? String(row.date).slice(0, 10) : "",
        category: row.category,
        note: row.note || "",
        status: row.status,
        paymentTransactionId: row.payment_transaction_id,
      });
    }
  }

  return NextResponse.json({ ok: true, data: accessible });
}
