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
      opening_savings_balance NUMERIC DEFAULT 0,
      opening_investment_balance NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS tracking_start_date DATE DEFAULT DATE '2024-01-01'");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS tracking_start_month INTEGER DEFAULT 1");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS tracking_start_year INTEGER DEFAULT 2024");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_cash_balance NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_savings_balance NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_investment_balance NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_cash_amount NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_debit_amount NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_wallet_amount NUMERIC DEFAULT 0");
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
             opening_cash_balance::float as "openingCashBalance",
             opening_savings_balance::float as "openingSavingsBalance",
             opening_investment_balance::float as "openingInvestmentBalance",
             opening_cash_amount::float as "openingCashAmount",
             opening_debit_amount::float as "openingDebitAmount",
             opening_wallet_amount::float as "openingWalletAmount"
      FROM finance_settings
      LIMIT 1
    `);
    if (result.rows.length === 0) {
      return NextResponse.json({ ok: true, data: { trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashBalance: 0, openingSavingsBalance: 0, openingInvestmentBalance: 0, openingCashAmount: 0, openingDebitAmount: 0, openingWalletAmount: 0 } });
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
    const openingSavingsBalance = Number(body.openingSavingsBalance ?? body.opening_savings_balance ?? 0) || 0;
    const openingInvestmentBalance = Number(body.openingInvestmentBalance ?? body.opening_investment_balance ?? 0) || 0;
    const openingCashAmount = Number(body.openingCashAmount ?? body.opening_cash_amount ?? 0) || 0;
    const openingDebitAmount = Number(body.openingDebitAmount ?? body.opening_debit_amount ?? 0) || 0;
    const openingWalletAmount = Number(body.openingWalletAmount ?? body.opening_wallet_amount ?? 0) || 0;

    const check = await pool.query("SELECT id FROM finance_settings LIMIT 1");
    if (check.rows.length > 0) {
      await pool.query(
        `UPDATE finance_settings
         SET tracking_start_date = $1,
             tracking_start_month = $2,
             tracking_start_year = $3,
             opening_cash_balance = $4,
             opening_savings_balance = $5,
             opening_investment_balance = $6,
             opening_cash_amount = $7,
             opening_debit_amount = $8,
             opening_wallet_amount = $9,
             updated_at = now()`,
        [start.date, start.month, start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance, openingCashAmount, openingDebitAmount, openingWalletAmount]
      );
    } else {
      await pool.query(
        `INSERT INTO finance_settings (tracking_start_date, tracking_start_month, tracking_start_year, opening_cash_balance, opening_savings_balance, opening_investment_balance, opening_cash_amount, opening_debit_amount, opening_wallet_amount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [start.date, start.month, start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance]
      );
    }

    return NextResponse.json({ ok: true, data: { trackingStartDate: start.date, trackingStartMonth: start.month, trackingStartYear: start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance, openingCashAmount, openingDebitAmount, openingWalletAmount } });
  } catch (error) {
    console.error("[PUT /api/finance-settings]", error);
    return NextResponse.json({ ok: false, error: "Lỗi server" }, { status: 500 });
  }
}
