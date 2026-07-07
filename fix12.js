const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// Replace Promise.all
const t_promise = `    const [incomeRecordsResult, expensesResult, savingsInExpenseResult, investmentsBuyResult, investmentsSellResult, adjustmentsResult, pendingCreditResult] = await Promise.all([
      pool.query(\`SELECT month, SUM(amount) as total FROM income_records WHERE status = 'Đã nhận' AND year = $1 AND \${filter.where} GROUP BY month\`, [year, ...filter.params]),
      pool.query(
        \`SELECT EXTRACT(MONTH FROM \${transactionDateExpr}) as month, SUM(amount) as total
         FROM transactions
         WHERE type = 'expense'
           AND \${realExpenseCondition}
           AND EXTRACT(YEAR FROM \${transactionDateExpr}) = $1
           AND \${filter.where}
         GROUP BY EXTRACT(MONTH FROM \${transactionDateExpr})\`,
        [year, ...filter.params]
      ),
      pool.query(
        \`SELECT EXTRACT(MONTH FROM \${transactionDateExpr}) as month, SUM(amount) as total
         FROM transactions
         WHERE type = 'expense'
           AND category = 'Tiết kiệm'
           AND EXTRACT(YEAR FROM \${transactionDateExpr}) = $1
           AND \${filter.where}
         GROUP BY EXTRACT(MONTH FROM \${transactionDateExpr})\`,
        [year, ...filter.params]
      ),
      pool.query(\`SELECT EXTRACT(MONTH FROM trade_date) as month, SUM(quantity * price + fee) as total FROM investment_transactions WHERE action = 'buy' AND EXTRACT(YEAR FROM trade_date) = $1 AND \${filter.where} GROUP BY EXTRACT(MONTH FROM trade_date)\`, [year, ...filter.params]),
      pool.query(\`SELECT EXTRACT(MONTH FROM trade_date) as month, SUM(quantity * price - fee) as total FROM investment_transactions WHERE action = 'sell' AND EXTRACT(YEAR FROM trade_date) = $1 AND \${filter.where} GROUP BY EXTRACT(MONTH FROM trade_date)\`, [year, ...filter.params]),
      pool.query(\`SELECT month, SUM(amount) as total FROM finance_adjustments WHERE year = $1 GROUP BY month\`, [year]),
      pool.query(\`SELECT EXTRACT(MONTH FROM date) as month, SUM(amount) as total FROM card_pending_transactions WHERE status = 'pending' AND EXTRACT(YEAR FROM date) = $1 AND \${filter.where} GROUP BY EXTRACT(MONTH FROM date)\`, [year, ...filter.params]),
    ]);`;

const r_promise = `    const [incomeRecordsResult, expensesResult, savingsInExpenseResult, investmentsBuyResult, investmentsSellResult, adjustmentsResult, pendingCreditResult, savingsRecordsResult] = await Promise.all([
      pool.query(\`SELECT month, SUM(amount) as total FROM income_records WHERE status = 'Đã nhận' AND year = $1 AND \${filter.where} GROUP BY month\`, [year, ...filter.params]),
      pool.query(
        \`SELECT EXTRACT(MONTH FROM \${transactionDateExpr}) as month, SUM(amount) as total
         FROM transactions
         WHERE type = 'expense'
           AND \${realExpenseCondition}
           AND EXTRACT(YEAR FROM \${transactionDateExpr}) = $1
           AND \${filter.where}
         GROUP BY EXTRACT(MONTH FROM \${transactionDateExpr})\`,
        [year, ...filter.params]
      ),
      pool.query(
        \`SELECT EXTRACT(MONTH FROM \${transactionDateExpr}) as month, SUM(amount) as total
         FROM transactions
         WHERE type = 'expense'
           AND category = 'Tiết kiệm'
           AND EXTRACT(YEAR FROM \${transactionDateExpr}) = $1
           AND \${filter.where}
         GROUP BY EXTRACT(MONTH FROM \${transactionDateExpr})\`,
        [year, ...filter.params]
      ),
      pool.query(\`SELECT EXTRACT(MONTH FROM trade_date) as month, SUM(quantity * price + fee) as total FROM investment_transactions WHERE action = 'buy' AND EXTRACT(YEAR FROM trade_date) = $1 AND \${filter.where} GROUP BY EXTRACT(MONTH FROM trade_date)\`, [year, ...filter.params]),
      pool.query(\`SELECT EXTRACT(MONTH FROM trade_date) as month, SUM(quantity * price - fee) as total FROM investment_transactions WHERE action = 'sell' AND EXTRACT(YEAR FROM trade_date) = $1 AND \${filter.where} GROUP BY EXTRACT(MONTH FROM trade_date)\`, [year, ...filter.params]),
      pool.query(\`SELECT month, SUM(amount) as total FROM finance_adjustments WHERE year = $1 GROUP BY month\`, [year]),
      pool.query(\`SELECT EXTRACT(MONTH FROM date) as month, SUM(amount) as total FROM card_pending_transactions WHERE status = 'pending' AND EXTRACT(YEAR FROM date) = $1 AND \${filter.where} GROUP BY EXTRACT(MONTH FROM date)\`, [year, ...filter.params]),
      pool.query(\`SELECT month, SUM(CASE WHEN type = 'withdraw' THEN -amount ELSE amount END) as total FROM savings_records WHERE year = $1 AND \${filter.where} GROUP BY month\`, [year, ...filter.params]),
    ]);`;

const t_datamap = `    const dataMap: Record<number, { month: number; income: number; expense: number; pendingCredit: number; savingsInExpense: number; investmentBuy: number; investmentSell: number; netInvestment: number; adjustment: number }> = {};
    for (let month = 1; month <= 12; month += 1) {
      dataMap[month] = { month, income: 0, expense: 0, pendingCredit: 0, savingsInExpense: 0, investmentBuy: 0, investmentSell: 0, netInvestment: 0, adjustment: 0 };
    }`;
const r_datamap = `    const dataMap: Record<number, { month: number; income: number; expense: number; pendingCredit: number; savingsInExpense: number; investmentBuy: number; investmentSell: number; netInvestment: number; adjustment: number; savingsRecords: number }> = {};
    for (let month = 1; month <= 12; month += 1) {
      dataMap[month] = { month, income: 0, expense: 0, pendingCredit: 0, savingsInExpense: 0, investmentBuy: 0, investmentSell: 0, netInvestment: 0, adjustment: 0, savingsRecords: 0 };
    }`;

const t_populate = `    for (const row of pendingCreditResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].pendingCredit += Number(row.total || 0);
    }`;
const r_populate = `    for (const row of pendingCreditResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].pendingCredit += Number(row.total || 0);
    }
    for (const row of savingsRecordsResult.rows) {
      if (dataMap[Number(row.month)]) dataMap[Number(row.month)].savingsRecords += Number(row.total || 0);
    }`;

const t_currentCash = `    const currentCash = settings.openingCashBalance
      + Number(row.total_income || 0)
      - Number(row.total_expense || 0)
      - Number(row.total_invest_buy || 0)
      + Number(row.total_invest_sell || 0)
      + totalAdjustment;`;

const r_currentCash = `
    const assetsQuery = await pool.query(
      \`SELECT
        (SELECT COALESCE(SUM(CASE WHEN type = 'withdraw' THEN -amount ELSE amount END), 0) FROM savings_records WHERE make_date(year::integer, month::integer, 1) >= $1::date AND \${filter.where}) as savings_records_total,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND category = 'Tiết kiệm' AND linked_savings_id IS NULL AND \${transactionDateExpr} >= $1::date AND \${filter.where}) as unlinked_savings_expense_total,
        (SELECT COALESCE(SUM(quantity * price + fee), 0) FROM investment_transactions WHERE action = 'buy' AND trade_date >= $1::date AND \${filter.where}) as investment_buy_total,
        (SELECT COALESCE(SUM(quantity * price - fee), 0) FROM investment_transactions WHERE action = 'sell' AND trade_date >= $1::date AND \${filter.where}) as investment_sell_total\`,
      [settings.trackingStartDate, ...filter.params]
    );
    const assets = assetsQuery.rows[0] || {};
    const savingsRecordsTotal = Number(assets.savings_records_total || 0);
    const savingsFromExpensesTotal = Number(assets.unlinked_savings_expense_total || 0);
    const investmentBuyTotal = Number(assets.investment_buy_total || 0);
    const investmentSellTotal = Number(assets.investment_sell_total || 0);
    const currentSavings = settings.openingSavingsBalance + savingsRecordsTotal + savingsFromExpensesTotal;
    const currentInvestment = settings.openingInvestmentBalance + investmentBuyTotal - investmentSellTotal;

    const currentCash = settings.openingCashBalance
      + Number(row.total_income || 0)
      - Number(row.total_expense || 0)
      - savingsRecordsTotal
      - savingsFromExpensesTotal
      - Number(row.total_invest_buy || 0)
      + Number(row.total_invest_sell || 0)
      + totalAdjustment;
    const estimatedAssets = currentCash + currentSavings + currentInvestment;`;

const t_assets = `    const assetsQuery = await pool.query(
      \`SELECT
        (SELECT COALESCE(SUM(CASE WHEN type = 'withdraw' THEN -amount ELSE amount END), 0) FROM savings_records WHERE make_date(year::integer, month::integer, 1) >= $1::date AND \${filter.where}) as savings_records_total,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND category = 'Tiết kiệm' AND linked_savings_id IS NULL AND \${transactionDateExpr} >= $1::date AND \${filter.where}) as unlinked_savings_expense_total,
        (SELECT COALESCE(SUM(quantity * price + fee), 0) FROM investment_transactions WHERE action = 'buy' AND trade_date >= $1::date AND \${filter.where}) as investment_buy_total,
        (SELECT COALESCE(SUM(quantity * price - fee), 0) FROM investment_transactions WHERE action = 'sell' AND trade_date >= $1::date AND \${filter.where}) as investment_sell_total\`,
      [settings.trackingStartDate, ...filter.params]
    );
    const assets = assetsQuery.rows[0] || {};
    const savingsRecordsTotal = Number(assets.savings_records_total || 0);
    const savingsFromExpensesTotal = Number(assets.unlinked_savings_expense_total || 0);
    const investmentBuyTotal = Number(assets.investment_buy_total || 0);
    const investmentSellTotal = Number(assets.investment_sell_total || 0);
    const currentSavings = settings.openingSavingsBalance + savingsRecordsTotal + savingsFromExpensesTotal;
    const currentInvestment = settings.openingInvestmentBalance + investmentBuyTotal - investmentSellTotal;
    const estimatedAssets = currentCash + currentSavings + currentInvestment;`;

const r_assets = ``; // already inserted in r_currentCash

const t_beforeQuery = `        (SELECT COALESCE(SUM(amount), 0) FROM finance_adjustments WHERE make_date(year::integer, month::integer, 1) >= make_date((EXTRACT(YEAR FROM $1::date))::integer, (EXTRACT(MONTH FROM $1::date))::integer, 1) AND make_date(year::integer, month::integer, 1) < $2::date) as total_adjustment\`,`;

const r_beforeQuery = `        (SELECT COALESCE(SUM(amount), 0) FROM finance_adjustments WHERE make_date(year::integer, month::integer, 1) >= make_date((EXTRACT(YEAR FROM $1::date))::integer, (EXTRACT(MONTH FROM $1::date))::integer, 1) AND make_date(year::integer, month::integer, 1) < $2::date) as total_adjustment,
        (SELECT COALESCE(SUM(CASE WHEN type = 'withdraw' THEN -amount ELSE amount END), 0) FROM savings_records WHERE make_date(year::integer, month::integer, 1) >= $1::date AND make_date(year::integer, month::integer, 1) < $2::date AND \${filter3.where}) as total_savings_records,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND category = 'Tiết kiệm' AND linked_savings_id IS NULL AND \${transactionDateExpr} >= $1::date AND \${transactionDateExpr} < $2::date AND \${filter3.where}) as total_savings_expense\`,`;

const t_cumulative = `    let cumulativeCash = settings.openingCashBalance
      + Number(beforeYear.total_income || 0)
      - Number(beforeYear.total_expense || 0)
      - Number(beforeYear.total_invest_buy || 0)
      + Number(beforeYear.total_invest_sell || 0)
      + Number(beforeYear.total_adjustment || 0);
    const monthlyData = Object.values(dataMap).sort((a, b) => a.month - b.month).map(item => {
      const afterExpense = item.income - item.expense;
      const netInvestment = item.investmentBuy - item.investmentSell;
      const monthlyCashFlow = afterExpense - item.investmentBuy + item.investmentSell + item.adjustment;
      const inTrackingRange = year > settings.trackingStartYear || (year === settings.trackingStartYear && item.month >= settings.trackingStartMonth);
      if (inTrackingRange) cumulativeCash += monthlyCashFlow;
      return { ...item, netInvestment, afterExpense, monthlyCashFlow, cumulativeCash };
    });`;

const r_cumulative = `    let cumulativeCash = settings.openingCashBalance
      + Number(beforeYear.total_income || 0)
      - Number(beforeYear.total_expense || 0)
      - Number(beforeYear.total_savings_records || 0)
      - Number(beforeYear.total_savings_expense || 0)
      - Number(beforeYear.total_invest_buy || 0)
      + Number(beforeYear.total_invest_sell || 0)
      + Number(beforeYear.total_adjustment || 0);
    const monthlyData = Object.values(dataMap).sort((a, b) => a.month - b.month).map(item => {
      const afterExpense = item.income - item.expense;
      const netInvestment = item.investmentBuy - item.investmentSell;
      const monthlyCashFlow = afterExpense - item.savingsInExpense - item.savingsRecords - item.investmentBuy + item.investmentSell + item.adjustment;
      const inTrackingRange = year > settings.trackingStartYear || (year === settings.trackingStartYear && item.month >= settings.trackingStartMonth);
      if (inTrackingRange) cumulativeCash += monthlyCashFlow;
      return { ...item, netInvestment, afterExpense, monthlyCashFlow, cumulativeCash };
    });`;

let hasError = false;
if (!content.includes(t_promise)) { console.log("t_promise missing"); hasError = true; }
if (!content.includes(t_datamap)) { console.log("t_datamap missing"); hasError = true; }
if (!content.includes(t_populate)) { console.log("t_populate missing"); hasError = true; }
if (!content.includes(t_currentCash)) { console.log("t_currentCash missing"); hasError = true; }
if (!content.includes(t_assets)) { console.log("t_assets missing"); hasError = true; }
if (!content.includes(t_beforeQuery)) { console.log("t_beforeQuery missing"); hasError = true; }
if (!content.includes(t_cumulative)) { console.log("t_cumulative missing"); hasError = true; }

if (hasError) process.exit(1);

content = content.replace(t_promise, r_promise);
content = content.replace(t_datamap, r_datamap);
content = content.replace(t_populate, r_populate);
content = content.replace(t_assets, r_assets); // empty out t_assets
content = content.replace(t_currentCash, r_currentCash);
content = content.replace(t_beforeQuery, r_beforeQuery);
content = content.replace(t_cumulative, r_cumulative);

fs.writeFileSync(file, content);
console.log("Patched finance-overview");
