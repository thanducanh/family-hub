import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });

  try {
    const result = await pool.query(`SELECT id, to_char(tracking_start_date, 'YYYY-MM-DD') as "trackingStartDate", opening_cash_balance::float as "openingCashBalance" FROM finance_settings LIMIT 1`);
    if (result.rows.length === 0) {
      return NextResponse.json({ ok: true, data: { trackingStartDate: '2024-01-01', openingCashBalance: 0 } });
    }
    return NextResponse.json({ ok: true, data: result.rows[0] });
  } catch (error) {
    console.error("[GET /api/finance-settings]", error);
    return NextResponse.json({ ok: false, error: "Lỗi server" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });

  try {
    const body = await req.json();
    const { trackingStartDate, openingCashBalance } = body;
    if (!trackingStartDate) return NextResponse.json({ ok: false, error: "Thiếu tham số" }, { status: 400 });

    const check = await pool.query(`SELECT id FROM finance_settings LIMIT 1`);
    if (check.rows.length > 0) {
      await pool.query(
        `UPDATE finance_settings SET tracking_start_date = $1, opening_cash_balance = $2, updated_at = now()`,
        [trackingStartDate, Number(openingCashBalance) || 0]
      );
    } else {
      await pool.query(
        `INSERT INTO finance_settings (tracking_start_date, opening_cash_balance) VALUES ($1, $2)`,
        [trackingStartDate, Number(openingCashBalance) || 0]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PUT /api/finance-settings]", error);
    return NextResponse.json({ ok: false, error: "Lỗi server" }, { status: 500 });
  }
}
