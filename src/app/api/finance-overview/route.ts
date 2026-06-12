import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });

  const yearStr = req.nextUrl.searchParams.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();

  try {
    // Fetch settings
    const settingsResult = await pool.query(`SELECT to_char(tracking_start_date, 'YYYY-MM-DD') as "trackingStartDate", opening_cash_balance::float as "openingCashBalance" FROM finance_settings LIMIT 1`);
    const trackingStartDate = settingsResult.rows.length > 0 ? settingsResult.rows[0].trackingStartDate : '2024-01-01';
    const openingCashBalance = settingsResult.rows.length > 0 ? Number(settingsResult.rows[0].openingCashBalance) || 0 : 0;

    // Fetch monthly data for the requested year
    const [incomeRecordsResult, expensesResult, savingsResult, investmentsBuyResult, investmentsSellResult] = await Promise.all([
      pool.query(`SELECT month, SUM(amount) as total FROM income_records WHERE status = 'Đã nhận' AND year = $1 GROUP BY month`, [year]),
      pool.query(`SELECT EXTRACT(MONTH FROM date) as month, SUM(amount) as total FROM transactions WHERE type = 'expense' AND EXTRACT(YEAR FROM date) = $1 GROUP BY EXTRACT(MONTH FROM date)`, [year]),
      pool.query(`SELECT month, SUM(CASE WHEN type != 'withdraw' THEN amount ELSE -amount END) as total FROM savings_records WHERE year = $1 GROUP BY month`, [year]),
      pool.query(`SELECT EXTRACT(MONTH FROM trade_date) as month, SUM(quantity * price + fee) as total FROM investment_transactions WHERE action = 'buy' AND EXTRACT(YEAR FROM trade_date) = $1 GROUP BY EXTRACT(MONTH FROM trade_date)`, [year]),
      pool.query(`SELECT EXTRACT(MONTH FROM trade_date) as month, SUM(quantity * price - fee) as total FROM investment_transactions WHERE action = 'sell' AND EXTRACT(YEAR FROM trade_date) = $1 GROUP BY EXTRACT(MONTH FROM trade_date)`, [year])
    ]);

    const dataMap: Record<number, { month: number; income: number; expense: number; savingsTransferred: number; netInvestment: number }> = {};
    for (let i = 1; i <= 12; i++) {
      dataMap[i] = { month: i, income: 0, expense: 0, savingsTransferred: 0, netInvestment: 0 };
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
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].netInvestment += Number(row.total || 0); // Buy means cash OUT of investment (wait, netInvestment means investment balance increases, but cash goes OUT).
      // Wait, let's define netInvestment as Mua - Bán (as requested by user: "Đầu tư ròng = Mua - Bán")
    }
    // Let's redefine: netInvestment = Buy (Outflow from cash) - Sell (Inflow to cash).
    // So Buy adds to netInvestment, Sell subtracts from netInvestment.
    for (const row of investmentsSellResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].netInvestment -= Number(row.total || 0);
    }

    // Now calculate currentCash from tracking_start_date
    const cashQuery = await pool.query(`
      SELECT
        (SELECT COALESCE(SUM(amount), 0) FROM income_records WHERE status = 'Đã nhận' AND (make_date(year::integer, month::integer, 1) >= $1::date)) as total_income,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND date >= $1::date) as total_expense,
        (SELECT COALESCE(SUM(CASE WHEN type != 'withdraw' THEN amount ELSE -amount END), 0) FROM savings_records WHERE (make_date(year::integer, month::integer, 1) >= $1::date)) as total_savings_net,
        (SELECT COALESCE(SUM(quantity * price + fee), 0) FROM investment_transactions WHERE action = 'buy' AND trade_date >= $1::date) as total_invest_buy,
        (SELECT COALESCE(SUM(quantity * price - fee), 0) FROM investment_transactions WHERE action = 'sell' AND trade_date >= $1::date) as total_invest_sell
    `, [trackingStartDate]);

    // For savings_records, it only stores year and month. We assume it's the 1st of the month.
    
    const row = cashQuery.rows[0];
    const tIncome = Number(row.total_income || 0);
    const tExpense = Number(row.total_expense || 0);
    const tSavingsNet = Number(row.total_savings_net || 0);
    const tInvestBuy = Number(row.total_invest_buy || 0);
    const tInvestSell = Number(row.total_invest_sell || 0);
    const tInvestNet = tInvestBuy - tInvestSell; // Cash out for investments

    const currentCash = openingCashBalance + tIncome - tExpense - tSavingsNet - tInvestNet;

    const monthlyData = Object.values(dataMap).sort((a, b) => a.month - b.month);

    return NextResponse.json({ 
      ok: true, 
      data: {
        monthlyData,
        currentCash,
        trackingStartDate,
        openingCashBalance
      }
    });
  } catch (error) {
    console.error("[GET /api/finance-overview]", error);
    return NextResponse.json({ ok: false, error: "Lỗi server" }, { status: 500 });
  }
}
