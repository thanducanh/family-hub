import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireSession, getSessionUser, buildDataFilter } from "@/lib/auth";
import { ensureCardPendingTransactionsTable } from "@/lib/card-pending-transactions";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_cash_amount NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_debit_amount NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_wallet_amount NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_savings_balance NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_investment_balance NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()");
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
}

async function getFinanceSettings() {
  try {
    await ensureFinanceSettingsTable();
    const result = await pool.query(
      `SELECT to_char(COALESCE(tracking_start_date, make_date(tracking_start_year, tracking_start_month, 1)), 'YYYY-MM-DD') as "trackingStartDate",
              COALESCE(tracking_start_month, EXTRACT(MONTH FROM tracking_start_date)::integer, 1) as "trackingStartMonth",
              COALESCE(tracking_start_year, EXTRACT(YEAR FROM tracking_start_date)::integer, 2024) as "trackingStartYear",
              opening_cash_balance::float as "openingCashBalance", opening_cash_amount::float as "openingCashAmount", opening_debit_amount::float as "openingDebitAmount", opening_wallet_amount::float as "openingWalletAmount",
              opening_savings_balance::float as "openingSavingsBalance",
              opening_investment_balance::float as "openingInvestmentBalance"
       FROM finance_settings
       LIMIT 1`
    );
    const row = result.rows[0] || {};
    return {
      trackingStartDate: row.trackingStartDate || "2024-01-01",
      trackingStartMonth: Number(row.trackingStartMonth || 1),
      trackingStartYear: Number(row.trackingStartYear || 2024),
      openingCashBalance: Number(row.openingCashBalance || 0), openingCashAmount: row.openingCashAmount, openingDebitAmount: row.openingDebitAmount, openingWalletAmount: row.openingWalletAmount,
      openingSavingsBalance: Number(row.openingSavingsBalance || 0),
      openingInvestmentBalance: Number(row.openingInvestmentBalance || 0),
    };
  } catch {
    return { trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashBalance: 0, openingSavingsBalance: 0, openingInvestmentBalance: 0 };
  }
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const yearParam = Number(url.searchParams.get("year"));
  const targetYear = Number.isFinite(yearParam) && yearParam > 0 ? yearParam : new Date().getFullYear();

  try {
    const filter = await buildDataFilter(user, '', 2, 'member_id', 'finance');
    const settings = await getFinanceSettings();
    const hasExpenseDate = await hasColumn("transactions", "expense_date");
    const transactionDateExpr = hasExpenseDate
      ? "COALESCE(date, expense_date, created_at)"
      : "COALESCE(date, created_at)";
    
    await ensureSavingsRecordsTable();
    await ensureCardPendingTransactionsTable();
    
    const hasIncomeDate = await hasColumn("income_records", "date");
    const incomeDateExpr = hasIncomeDate ? "date" : "received_date";
    const hasIncomeStatus = await hasColumn("income_records", "status");
    const incomeStatusCond = hasIncomeStatus ? "status = 'Đã nhận'" : "1=1";
    
    await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS linked_savings_id UUID");
    await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS counts_for_personal_expense BOOLEAN NOT NULL DEFAULT TRUE");
    await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS counts_for_card_spending BOOLEAN NOT NULL DEFAULT TRUE");
    await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_reimbursable BOOLEAN NOT NULL DEFAULT FALSE");
    await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursement_person TEXT");
    await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursement_status TEXT NOT NULL DEFAULT 'none'");
    await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursed_amount NUMERIC NOT NULL DEFAULT 0");
    await pool.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reimbursed_at DATE");
    const realExpenseCondition = "COALESCE(counts_for_personal_expense, CASE WHEN category IN ('Tiết kiệm', 'Thanh toán hộ') THEN false ELSE true END) = true";

    await ensureAdjustmentsTable();

    const [incomeResult, expensesResult, savingsInExpenseResult, investmentsBuyResult, investmentsSellResult, adjustmentsResult, pendingCreditResult, savingsRecordsResult] = await Promise.all([
      pool.query(`SELECT EXTRACT(YEAR FROM ${incomeDateExpr}) as year, EXTRACT(MONTH FROM ${incomeDateExpr}) as month, SUM(amount) as total FROM income_records WHERE ${incomeStatusCond} AND ${incomeDateExpr} >= $1::date AND ${filter.where} GROUP BY year, month`, [settings.trackingStartDate, ...filter.params]),
      pool.query(
        `SELECT EXTRACT(YEAR FROM ${transactionDateExpr}) as year, EXTRACT(MONTH FROM ${transactionDateExpr}) as month, SUM(amount) as total
         FROM transactions
         WHERE type = 'expense'
           AND ${realExpenseCondition}
           AND ${transactionDateExpr} >= $1::date
           AND ${filter.where}
         GROUP BY year, month`,
        [settings.trackingStartDate, ...filter.params]
      ),
      pool.query(
        `SELECT EXTRACT(YEAR FROM ${transactionDateExpr}) as year, EXTRACT(MONTH FROM ${transactionDateExpr}) as month, SUM(amount) as total
         FROM transactions
         WHERE type = 'expense'
           AND category = 'Tiết kiệm'
           AND linked_savings_id IS NULL
           AND ${transactionDateExpr} >= $1::date
           AND ${filter.where}
         GROUP BY year, month`,
        [settings.trackingStartDate, ...filter.params]
      ),
      pool.query(`SELECT EXTRACT(YEAR FROM trade_date) as year, EXTRACT(MONTH FROM trade_date) as month, SUM(quantity * price + fee) as total FROM investment_transactions WHERE action = 'buy' AND trade_date >= $1::date AND ${filter.where} GROUP BY year, month`, [settings.trackingStartDate, ...filter.params]),
      pool.query(`SELECT EXTRACT(YEAR FROM trade_date) as year, EXTRACT(MONTH FROM trade_date) as month, SUM(quantity * price - fee) as total FROM investment_transactions WHERE action = 'sell' AND trade_date >= $1::date AND ${filter.where} GROUP BY year, month`, [settings.trackingStartDate, ...filter.params]),
      pool.query(`SELECT year, month, SUM(amount) as total FROM finance_adjustments WHERE make_date(year::integer, month::integer, 1) >= make_date((EXTRACT(YEAR FROM $1::date))::integer, (EXTRACT(MONTH FROM $1::date))::integer, 1) GROUP BY year, month`, [settings.trackingStartDate]),
      pool.query(`SELECT EXTRACT(MONTH FROM date) as month, SUM(amount) as total FROM card_pending_transactions WHERE status = 'pending' AND EXTRACT(YEAR FROM date) = $2 AND ${filter.where} GROUP BY month`, [settings.trackingStartDate, targetYear, ...filter.params]),
      pool.query(`SELECT EXTRACT(YEAR FROM date) as year, EXTRACT(MONTH FROM date) as month, SUM(CASE WHEN type = 'withdraw' THEN -amount ELSE amount END) as total FROM savings_records WHERE date >= $1::date AND ${filter.where} GROUP BY year, month`, [settings.trackingStartDate, ...filter.params])
    ]);

    const hasNewFields = settings.openingCashAmount !== undefined && settings.openingCashAmount !== null;
    const initialCash = hasNewFields 
      ? ((settings.openingCashAmount || 0) + (settings.openingDebitAmount || 0) + (settings.openingWalletAmount || 0)) 
      : (settings.openingCashBalance || 0);

    const groupedData: Record<string, any> = {};
    const addData = (result: any, key: string) => {
      for (const row of result.rows) {
        const y = Number(row.year);
        const m = Number(row.month);
        const k = `${y}-${m}`;
        if (!groupedData[k]) groupedData[k] = { income: 0, expense: 0, savingsInExpense: 0, savingsRecords: 0, investmentBuy: 0, investmentSell: 0, adjustment: 0 };
        groupedData[k][key] += Number(row.total || 0);
      }
    };
    
    addData(incomeResult, 'income');
    addData(expensesResult, 'expense');
    addData(savingsInExpenseResult, 'savingsInExpense');
    addData(savingsRecordsResult, 'savingsRecords');
    addData(investmentsBuyResult, 'investmentBuy');
    addData(investmentsSellResult, 'investmentSell');
    addData(adjustmentsResult, 'adjustment');

    const pendingCreditMap: Record<number, number> = {};
    for (const row of pendingCreditResult.rows) {
      pendingCreditMap[Number(row.month)] = Number(row.total || 0);
    }

    const currentRealYear = new Date().getFullYear();
    const currentRealMonth = new Date().getMonth() + 1;
    const endYear = Math.max(targetYear, currentRealYear);

    let runningCash = initialCash;
    let runningSavings = settings.openingSavingsBalance || 0;
    let runningInvestment = settings.openingInvestmentBalance || 0;
    
    let totalIncome = 0;
    let totalExpense = 0;
    let totalSavingsFromExpenses = 0;
    let totalManualSavings = 0;
    let totalInvestBuy = 0;
    let totalInvestSell = 0;

    const targetYearData = [];

    for (let m = 1; m < settings.trackingStartMonth && targetYear === settings.trackingStartYear; m++) {
      targetYearData.push({
        month: m,
        inTrackingRange: false,
        isFuture: false,
        isHistorical: true,
        openingBalance: null,
        cumulativeCash: null,
        income: 0,
        expense: 0,
        savingsInExpense: 0,
        savingsRecords: 0,
        investmentBuy: 0,
        investmentSell: 0,
        netInvestment: 0,
        adjustment: 0,
        monthlyCashFlow: 0,
        pendingCredit: pendingCreditMap[m] || 0
      });
    }

    for (let y = settings.trackingStartYear; y <= endYear; y++) {
      const startM = (y === settings.trackingStartYear) ? settings.trackingStartMonth : 1;
      for (let m = startM; m <= 12; m++) {
        const k = `${y}-${m}`;
        const data = groupedData[k] || { income: 0, expense: 0, savingsInExpense: 0, savingsRecords: 0, investmentBuy: 0, investmentSell: 0, adjustment: 0 };
        
        const afterExpense = data.income - data.expense;
        const netInvestment = data.investmentBuy - data.investmentSell;
        const monthlyCashFlow = afterExpense - data.savingsInExpense - data.savingsRecords - data.investmentBuy + data.investmentSell + data.adjustment;
        
        const isFuture = y > currentRealYear || (y === currentRealYear && m > currentRealMonth);
        
        let openingBalance = isFuture ? null : runningCash;
        let monthCumulative = isFuture ? null : (runningCash + monthlyCashFlow);

        if (!isFuture) {
          runningCash += monthlyCashFlow;
          runningSavings += data.savingsRecords + data.savingsInExpense;
          runningInvestment += data.investmentBuy - data.investmentSell;
          
          totalIncome += data.income;
          totalExpense += data.expense;
          totalSavingsFromExpenses += data.savingsInExpense;
          totalManualSavings += data.savingsRecords;
          totalInvestBuy += data.investmentBuy;
          totalInvestSell += data.investmentSell;
        }

        if (y === targetYear) {
          targetYearData.push({
            month: m,
            inTrackingRange: true,
            isFuture,
            isHistorical: false,
            openingBalance,
            cumulativeCash: monthCumulative,
            income: data.income,
            expense: data.expense,
            savingsInExpense: data.savingsInExpense,
            savingsRecords: data.savingsRecords,
            investmentBuy: data.investmentBuy,
            investmentSell: data.investmentSell,
            netInvestment,
            adjustment: data.adjustment,
            monthlyCashFlow,
            pendingCredit: pendingCreditMap[m] || 0
          });
        }
      }
    }

    const currentCash = runningCash;
    const currentSavings = runningSavings;
    const currentInvestment = runningInvestment;
    const estimatedAssets = currentCash + currentSavings + currentInvestment;

    const pendingFilter = await buildDataFilter(user, "", 2, "member_id", "finance");
    const paramsPending = ["pending", ...pendingFilter.params];
    const wherePending = `status = $1 AND ${pendingFilter.where}`;
    const globalPendingCreditQuery = await pool.query(`SELECT SUM(amount) as total FROM card_pending_transactions WHERE ${wherePending}`, paramsPending);
    const pendingCreditTotal = Number(globalPendingCreditQuery.rows[0]?.total || 0);
    
    return NextResponse.json({
      ok: true,
      data: {
        pendingCreditTotal,
        monthlyData: targetYearData.sort((a, b) => a.month - b.month),
        currentCash,
        currentSavings,
        currentInvestment,
        estimatedAssets,
        cashBreakdown: {
          startDate: settings.trackingStartDate,
          openingCashBalance: initialCash,
          incomeSinceStart: totalIncome,
          realExpenseSinceStart: totalExpense,
          savingTransferSinceStart: totalSavingsFromExpenses,
          investmentBuySinceStart: totalInvestBuy,
          investmentSellSinceStart: totalInvestSell,
          currentCash,
        },
        savingsBreakdown: {
          startDate: settings.trackingStartDate,
          openingSavingsBalance: settings.openingSavingsBalance,
          savingFromExpensesSinceStart: totalSavingsFromExpenses,
          manualSavingsSinceStart: totalManualSavings,
          currentSavings,
        },
        investmentBreakdown: {
          startDate: settings.trackingStartDate,
          openingInvestmentBalance: settings.openingInvestmentBalance,
          investmentBuySinceStart: totalInvestBuy,
          investmentSellSinceStart: totalInvestSell,
          currentInvestment,
        },
        totalAssetBreakdown: {
          currentCash,
          currentSavings,
          currentInvestment,
          totalAssets: estimatedAssets,
        },
        ...settings,
        settings,
      }
    });
  } catch (error: any) {
    console.error("[GET /api/finance-overview]", error);
    return NextResponse.json({ ok: false, error: "Không thể tải tổng quan thu chi." }, { status: 500 });
  }
}
