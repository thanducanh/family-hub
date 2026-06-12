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

async function getFinanceSettings() {
  try {
    const result = await pool.query(
      `SELECT to_char(tracking_start_date, 'YYYY-MM-DD') as "trackingStartDate",
              opening_cash_balance::float as "openingCashBalance"
       FROM finance_settings
       LIMIT 1`
    );
    return {
      trackingStartDate: result.rows[0]?.trackingStartDate || "2024-01-01",
      openingCashBalance: Number(result.rows[0]?.openingCashBalance || 0),
    };
  } catch {
    return { trackingStartDate: "2024-01-01", openingCashBalance: 0 };
  }
}

export async function GET(req: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });

  const yearParam = Number(req.nextUrl.searchParams.get("year"));
  const year = Number.isFinite(yearParam) && yearParam > 0 ? yearParam : new Date().getFullYear();

  try {
    const { trackingStartDate, openingCashBalance } = await getFinanceSettings();
    const hasExpenseDate = await hasColumn("transactions", "expense_date");
    const transactionDateExpr = hasExpenseDate
      ? "COALESCE(date, expense_date, created_at)"
      : "COALESCE(date, created_at)";

    const [incomeRecordsResult, expensesResult, savingsResult, investmentsBuyResult, investmentsSellResult] = await Promise.all([
      pool.query(`SELECT month, SUM(amount) as total FROM income_records WHERE status = 'Đã nhận' AND year = $1 GROUP BY month`, [year]),
      pool.query(
        `SELECT EXTRACT(MONTH FROM ${transactionDateExpr}) as month, SUM(amount) as total
         FROM transactions
         WHERE type = 'expense'
           AND EXTRACT(YEAR FROM ${transactionDateExpr}) = $1
         GROUP BY EXTRACT(MONTH FROM ${transactionDateExpr})`,
        [year]
      ),
      pool.query(`SELECT month, SUM(CASE WHEN type != 'withdraw' THEN amount ELSE -amount END) as total FROM savings_records WHERE year = $1 GROUP BY month`, [year]),
      pool.query(`SELECT EXTRACT(MONTH FROM trade_date) as month, SUM(quantity * price + fee) as total FROM investment_transactions WHERE action = 'buy' AND EXTRACT(YEAR FROM trade_date) = $1 GROUP BY EXTRACT(MONTH FROM trade_date)`, [year]),
      pool.query(`SELECT EXTRACT(MONTH FROM trade_date) as month, SUM(quantity * price - fee) as total FROM investment_transactions WHERE action = 'sell' AND EXTRACT(YEAR FROM trade_date) = $1 GROUP BY EXTRACT(MONTH FROM trade_date)`, [year]),
    ]);

    const dataMap: Record<number, { month: number; income: number; expense: number; savingsTransferred: number; netInvestment: number }> = {};
    for (let month = 1; month <= 12; month += 1) {
      dataMap[month] = { month, income: 0, expense: 0, savingsTransferred: 0, netInvestment: 0 };
    }

    for (const row of incomeRecordsResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].income += Number(row.total || 0);
    }
    for (const row of expensesResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].expense += Number(row.total || 0);
    }
    for (const row of savingsResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].savingsTransferred += Number(row.total || 0);
    }
    for (const row of investmentsBuyResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].netInvestment += Number(row.total || 0);
    }
    for (const row of investmentsSellResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].netInvestment -= Number(row.total || 0);
    }

    const cashQuery = await pool.query(
      `SELECT
        (SELECT COALESCE(SUM(amount), 0) FROM income_records WHERE status = 'Đã nhận' AND make_date(year::integer, month::integer, 1) >= $1::date) as total_income,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND ${transactionDateExpr} >= $1::date) as total_expense,
        (SELECT COALESCE(SUM(CASE WHEN type != 'withdraw' THEN amount ELSE -amount END), 0) FROM savings_records WHERE make_date(year::integer, month::integer, 1) >= $1::date) as total_savings_net,
        (SELECT COALESCE(SUM(quantity * price + fee), 0) FROM investment_transactions WHERE action = 'buy' AND trade_date >= $1::date) as total_invest_buy,
        (SELECT COALESCE(SUM(quantity * price - fee), 0) FROM investment_transactions WHERE action = 'sell' AND trade_date >= $1::date) as total_invest_sell`,
      [trackingStartDate]
    );

    const row = cashQuery.rows[0] || {};
    const currentCash = openingCashBalance
      + Number(row.total_income || 0)
      - Number(row.total_expense || 0)
      - Number(row.total_savings_net || 0)
      - (Number(row.total_invest_buy || 0) - Number(row.total_invest_sell || 0));

    const monthlyData = Object.values(dataMap).sort((a, b) => a.month - b.month);

    return NextResponse.json({
      ok: true,
      data: {
        monthlyData,
        currentCash,
        trackingStartDate,
        openingCashBalance,
      },
    });
  } catch (error) {
    console.error("[GET /api/finance-overview]", error);
    return NextResponse.json({ ok: false, error: "Không thể tải tổng quan thu chi." }, { status: 500 });
  }
}
