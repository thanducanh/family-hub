import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getSessionUser } from "@/lib/auth";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await pool.query(
      `SELECT id, member_id as "memberId", to_char(trade_date, 'YYYY-MM-DD') as "tradeDate", stock_code as "stockCode", action, quantity::float, price::float, fee::float, note, created_at as "createdAt", updated_at as "updatedAt"
       FROM investment_transactions
       ORDER BY trade_date DESC, created_at DESC`
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("GET /api/investments error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const id = crypto.randomUUID();
    const { tradeDate, stockCode, action, quantity, price, fee, note } = body;
    
    // For regular users, force memberId to their own. Admin can set it if we allowed in UI, but here we just use user's memberId or what's passed
    const memberId = user.role === "full_access" ? body.memberId || user.memberId : user.memberId;

    await pool.query(
      `INSERT INTO investment_transactions (id, member_id, trade_date, stock_code, action, quantity, price, fee, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, memberId, tradeDate, stockCode.toUpperCase(), action, quantity, price, fee || 0, note || '']
    );

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("POST /api/investments error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
