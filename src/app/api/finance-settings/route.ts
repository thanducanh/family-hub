import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";

async function ensureFinanceSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tracking_start_date DATE DEFAULT DATE '2024-01-01',
      tracking_start_month INTEGER DEFAULT 1,
      tracking_start_year INTEGER DEFAULT 2024,
      opening_cash_balance NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS tracking_start_date DATE DEFAULT DATE '2024-01-01'");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS tracking_start_month INTEGER DEFAULT 1");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS tracking_start_year INTEGER DEFAULT 2024");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_cash_balance NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()");
}

function normalizeStart(body: Record<string, unknown>) {
  const trackingStartDate = String(body.trackingStartDate || body.tracking_start_date || "");
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(trackingStartDate) ? trackingStartDate : "";
  const dateParts = fromDate ? fromDate.split("-").map(Number) : [];
  const month = Number(body.trackingStartMonth || body.tracking_start_month || dateParts[1] || 1);
  const year = Number(body.trackingStartYear || body.tracking_start_year || dateParts[0] || new Date().getFullYear());
  const safeMonth = Math.min(12, Math.max(1, Number.isFinite(month) ? month : 1));
  const safeYear = Number.isFinite(year) && year > 1900 ? year : new Date().getFullYear();
  return {
    month: safeMonth,
    year: safeYear,
    date: `${safeYear}-${String(safeMonth).padStart(2, "0")}-01`,
  };
}

export async function GET() {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });

  try {
    await ensureFinanceSettingsTable();
    const result = await pool.query(`
      SELECT id,
             to_char(COALESCE(tracking_start_date, make_date(tracking_start_year, tracking_start_month, 1)), 'YYYY-MM-DD') as "trackingStartDate",
             COALESCE(tracking_start_month, EXTRACT(MONTH FROM tracking_start_date)::integer, 1) as "trackingStartMonth",
             COALESCE(tracking_start_year, EXTRACT(YEAR FROM tracking_start_date)::integer, 2024) as "trackingStartYear",
             opening_cash_balance::float as "openingCashBalance"
      FROM finance_settings
      LIMIT 1
    `);
    if (result.rows.length === 0) {
      return NextResponse.json({ ok: true, data: { trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashBalance: 0 } });
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
    await ensureFinanceSettingsTable();
    const body = await req.json();
    const start = normalizeStart(body);
    const openingCashBalance = Number(body.openingCashBalance ?? body.opening_cash_balance ?? 0) || 0;

    const check = await pool.query("SELECT id FROM finance_settings LIMIT 1");
    if (check.rows.length > 0) {
      await pool.query(
        `UPDATE finance_settings
         SET tracking_start_date = $1,
             tracking_start_month = $2,
             tracking_start_year = $3,
             opening_cash_balance = $4,
             updated_at = now()`,
        [start.date, start.month, start.year, openingCashBalance]
      );
    } else {
      await pool.query(
        `INSERT INTO finance_settings (tracking_start_date, tracking_start_month, tracking_start_year, opening_cash_balance)
         VALUES ($1, $2, $3, $4)`,
        [start.date, start.month, start.year, openingCashBalance]
      );
    }

    return NextResponse.json({ ok: true, data: { trackingStartDate: start.date, trackingStartMonth: start.month, trackingStartYear: start.year, openingCashBalance } });
  } catch (error) {
    console.error("[PUT /api/finance-settings]", error);
    return NextResponse.json({ ok: false, error: "Lỗi server" }, { status: 500 });
  }
}
