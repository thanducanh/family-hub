import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getSessionUser } from "@/lib/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = await props.params;
    const body = await request.json();
    const { tradeDate, stockCode, action, quantity, price, fee, note } = body;

    // Check existing
    const existing = await pool.query(`SELECT * FROM investment_transactions WHERE id = $1`, [params.id]);
    if (existing.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role !== "full_access" && existing.rows[0].member_id !== user.memberId && existing.rows[0].member_id !== null) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await pool.query(
      `UPDATE investment_transactions 
       SET trade_date = $1, stock_code = $2, action = $3, quantity = $4, price = $5, fee = $6, note = $7, updated_at = now()
       WHERE id = $8`,
      [tradeDate, stockCode.toUpperCase(), action, quantity, price, fee || 0, note || '', params.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/investments/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const params = await props.params;
    const existing = await pool.query(`SELECT * FROM investment_transactions WHERE id = $1`, [params.id]);
    if (existing.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role !== "full_access" && existing.rows[0].member_id !== user.memberId && existing.rows[0].member_id !== null) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await pool.query(`DELETE FROM investment_transactions WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/investments/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
