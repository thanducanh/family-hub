import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";

async function hasColumn(tableName: string, columnName: string) {
  const result = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );
  return (result.rowCount || 0) > 0;
}

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
}

async function ensureSavingsRecordsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS savings_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID REFERENCES members(id) ON DELETE SET NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'monthly',
      holder TEXT NOT NULL DEFAULT 'Ngân hàng',
      description TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getFinanceSettings() {
  try {
    await ensureFinanceSettingsTable();
    const result = await pool.query(
      `SELECT to_char(COALESCE(tracking_start_date, make_date(tracking_start_year, tracking_start_month, 1)), 'YYYY-MM-DD') as "trackingStartDate",
              COALESCE(tracking_start_month, EXTRACT(MONTH FROM tracking_start_date)::integer, 1) as "trackingStartMonth",
              COALESCE(tracking_start_year, EXTRACT(YEAR FROM tracking_start_date)::integer, 2024) as "trackingStartYear",
              opening_cash_balance::float as "openingCashBalance"
       FROM finance_settings
       LIMIT 1`
    );
    const row = result.rows[0] || {};
    return {
      trackingStartDate: row.trackingStartDate || "2024-01-01",
      trackingStartMonth: Number(row.trackingStartMonth || 1),
      trackingStartYear: Number(row.trackingStartYear || 2024),
      openingCashBalance: Number(row.openingCashBalance || 0),
    };
  } catch {
    return { trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashBalance: 0 };
  }
}

export async function GET(req: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });

  const yearParam = Number(req.nextUrl.searchParams.get("year"));
  const year = Number.isFinite(yearParam) && yearParam > 0 ? yearParam : new Date().getFullYear();

  try {
    const settings = await getFinanceSettings();
    const hasExpenseDate = await hasColumn("transactions", "expense_date");
    const transactionDateExpr = hasExpenseDate
      ? "COALESCE(date, expense_date, created_at)"
      : "COALESCE(date, created_at)";
    await ensureSavingsRecordsTable();
    await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS linked_savings_id UUID");

    const [incomeRecordsResult, expensesResult, savingsInExpenseResult, investmentsBuyResult, investmentsSellResult] = await Promise.all([
      pool.query(`SELECT month, SUM(amount) as total FROM income_records WHERE status = 'Đã nhận' AND year = $1 GROUP BY month`, [year]),
      pool.query(
        `SELECT EXTRACT(MONTH FROM ${transactionDateExpr}) as month, SUM(amount) as total
         FROM transactions
         WHERE type = 'expense'
           AND EXTRACT(YEAR FROM ${transactionDateExpr}) = $1
         GROUP BY EXTRACT(MONTH FROM ${transactionDateExpr})`,
        [year]
      ),
      pool.query(
        `SELECT EXTRACT(MONTH FROM ${transactionDateExpr}) as month, SUM(amount) as total
         FROM transactions
         WHERE type = 'expense'
           AND category = 'Tiết kiệm'
           AND EXTRACT(YEAR FROM ${transactionDateExpr}) = $1
         GROUP BY EXTRACT(MONTH FROM ${transactionDateExpr})`,
        [year]
      ),
      pool.query(`SELECT EXTRACT(MONTH FROM trade_date) as month, SUM(quantity * price + fee) as total FROM investment_transactions WHERE action = 'buy' AND EXTRACT(YEAR FROM trade_date) = $1 GROUP BY EXTRACT(MONTH FROM trade_date)`, [year]),
      pool.query(`SELECT EXTRACT(MONTH FROM trade_date) as month, SUM(quantity * price - fee) as total FROM investment_transactions WHERE action = 'sell' AND EXTRACT(YEAR FROM trade_date) = $1 GROUP BY EXTRACT(MONTH FROM trade_date)`, [year]),
    ]);

    const dataMap: Record<number, { month: number; income: number; expense: number; savingsInExpense: number; investmentBuy: number; investmentSell: number; netInvestment: number }> = {};
    for (let month = 1; month <= 12; month += 1) {
      dataMap[month] = { month, income: 0, expense: 0, savingsInExpense: 0, investmentBuy: 0, investmentSell: 0, netInvestment: 0 };
    }

    for (const row of incomeRecordsResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].income += Number(row.total || 0);
    }
    for (const row of expensesResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].expense += Number(row.total || 0);
    }
    for (const row of savingsInExpenseResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].savingsInExpense += Number(row.total || 0);
    }
    for (const row of investmentsBuyResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].investmentBuy += Number(row.total || 0);
    }
    for (const row of investmentsSellResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].investmentSell += Number(row.total || 0);
    }

    const cashQuery = await pool.query(
      `SELECT
        (SELECT COALESCE(SUM(amount), 0) FROM income_records WHERE status = 'Đã nhận' AND make_date(year::integer, month::integer, 1) >= $1::date) as total_income,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND ${transactionDateExpr} >= $1::date) as total_expense,
        (SELECT COALESCE(SUM(quantity * price + fee), 0) FROM investment_transactions WHERE action = 'buy' AND trade_date >= $1::date) as total_invest_buy,
        (SELECT COALESCE(SUM(quantity * price - fee), 0) FROM investment_transactions WHERE action = 'sell' AND trade_date >= $1::date) as total_invest_sell`,
      [settings.trackingStartDate]
    );

    const row = cashQuery.rows[0] || {};
    const currentCash = settings.openingCashBalance
      + Number(row.total_income || 0)
      - Number(row.total_expense || 0)
      - Number(row.total_invest_buy || 0)
      + Number(row.total_invest_sell || 0);

    const assetsQuery = await pool.query(
      `SELECT
        (SELECT COALESCE(SUM(CASE WHEN type = 'withdraw' THEN -amount ELSE amount END), 0) FROM savings_records) as savings_records_total,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND category = 'Tiết kiệm' AND linked_savings_id IS NULL) as unlinked_savings_expense_total,
        (SELECT COALESCE(SUM(quantity * price + fee), 0) FROM investment_transactions WHERE action = 'buy') as investment_buy_total,
        (SELECT COALESCE(SUM(quantity * price - fee), 0) FROM investment_transactions WHERE action = 'sell') as investment_sell_total`
    );
    const assets = assetsQuery.rows[0] || {};
    const currentSavings = Number(assets.savings_records_total || 0) + Number(assets.unlinked_savings_expense_total || 0);
    const currentInvestment = Number(assets.investment_buy_total || 0) - Number(assets.investment_sell_total || 0);
    const estimatedAssets = currentCash + currentSavings + currentInvestment;

    const yearStartDate = `${year}-01-01`;
    const beforeYearQuery = await pool.query(
      `SELECT
        (SELECT COALESCE(SUM(amount), 0) FROM income_records WHERE status = 'Đã nhận' AND make_date(year::integer, month::integer, 1) >= $1::date AND make_date(year::integer, month::integer, 1) < $2::date) as total_income,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND ${transactionDateExpr} >= $1::date AND ${transactionDateExpr} < $2::date) as total_expense,
        (SELECT COALESCE(SUM(quantity * price + fee), 0) FROM investment_transactions WHERE action = 'buy' AND trade_date >= $1::date AND trade_date < $2::date) as total_invest_buy,
        (SELECT COALESCE(SUM(quantity * price - fee), 0) FROM investment_transactions WHERE action = 'sell' AND trade_date >= $1::date AND trade_date < $2::date) as total_invest_sell`,
      [settings.trackingStartDate, yearStartDate]
    );
    const beforeYear = beforeYearQuery.rows[0] || {};
    let cumulativeCash = settings.openingCashBalance
      + Number(beforeYear.total_income || 0)
      - Number(beforeYear.total_expense || 0)
      - Number(beforeYear.total_invest_buy || 0)
      + Number(beforeYear.total_invest_sell || 0);
    const monthlyData = Object.values(dataMap).sort((a, b) => a.month - b.month).map(item => {
      const afterExpense = item.income - item.expense;
      const netInvestment = item.investmentBuy - item.investmentSell;
      const monthlyCashFlow = afterExpense - item.investmentBuy + item.investmentSell;
      const inTrackingRange = year > settings.trackingStartYear || (year === settings.trackingStartYear && item.month >= settings.trackingStartMonth);
      if (inTrackingRange) cumulativeCash += monthlyCashFlow;
      return { ...item, netInvestment, afterExpense, monthlyCashFlow, cumulativeCash };
    });

    return NextResponse.json({
      ok: true,
      data: {
        monthlyData,
        currentCash,
        currentSavings,
        currentInvestment,
        estimatedAssets,
        ...settings,
        settings,
      },
    });
  } catch (error) {
    console.error("[GET /api/finance-overview]", error);
    return NextResponse.json({ ok: false, error: "Không thể tải tổng quan thu chi." }, { status: 500 });
  }
}
