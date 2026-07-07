import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

async function ensureAdjustmentsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_adjustments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query("ALTER TABLE finance_adjustments ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE");
  await pool.query("ALTER TABLE finance_adjustments ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'cash'");
  await pool.query("ALTER TABLE finance_adjustments ADD COLUMN IF NOT EXISTS member_id UUID");
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    await ensureAdjustmentsTable();
    const result = await pool.query(
      `SELECT * FROM finance_adjustments ORDER BY year DESC, month DESC, created_at DESC`
    );
    return NextResponse.json({ ok: true, data: result.rows });
  } catch (error) {
    console.error("[GET /api/finance-adjustments]", error);
    return NextResponse.json({ ok: false, error: "Lỗi server" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    await ensureAdjustmentsTable();
    const body = await req.json();
    const amount = Number(body.amount || 0);
    if (!amount) return NextResponse.json({ ok: false, error: "Số tiền không hợp lệ" }, { status: 400 });

    const date = body.date || new Date().toISOString().split('T')[0];
    const sourceType = body.sourceType || body.source_type || 'cash';
    const memberId = body.memberId || body.member_id || (user as any).id || null;

    const result = await pool.query(
      `INSERT INTO finance_adjustments (month, year, amount, note, created_by, date, source_type, member_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [body.month, body.year, amount, String(body.note || ""), String((user as any).name || (user as any).email || ""), date, sourceType, memberId]
    );

    return NextResponse.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    console.error("[POST /api/finance-adjustments]", error);
    return NextResponse.json({ ok: false, error: "Lỗi server" }, { status: 500 });
  }
}
