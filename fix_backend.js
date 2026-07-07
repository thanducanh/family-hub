const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. initialCash Logic
const initialCashOld = `    const totalOpeningCashFields = (settings.openingCashAmount || 0) + (settings.openingDebitAmount || 0) + (settings.openingWalletAmount || 0);
    const initialCash = (totalOpeningCashFields > 0 || settings.openingCashAmount !== undefined) && (settings.openingCashAmount > 0 || settings.openingDebitAmount > 0 || settings.openingWalletAmount > 0) ? totalOpeningCashFields : settings.openingCashBalance;`;

const initialCashNew = `    const hasNewFields = settings.openingCashAmount !== undefined && settings.openingCashAmount !== null;
    const initialCash = hasNewFields 
      ? ((settings.openingCashAmount || 0) + (settings.openingDebitAmount || 0) + (settings.openingWalletAmount || 0)) 
      : (settings.openingCashBalance || 0);`;

content = content.replace(initialCashOld, initialCashNew);

// 2. assetsQuery move UP before currentCash
const assetsQueryBlockRegex = /    const assetsQuery = await pool\.query\([\s\S]*?const estimatedAssets = currentCash \+ currentSavings \+ currentInvestment;/;
const matchAssets = content.match(assetsQueryBlockRegex);
if (matchAssets) {
    const assetsQueryBlock = matchAssets[0];
    content = content.replace(assetsQueryBlock, ''); // remove from original place
    
    // find where to insert: right before const currentCash = initialCash
    const insertPoint = `    const currentCash = initialCash`;
    content = content.replace(insertPoint, assetsQueryBlock + '\n\n' + insertPoint);
}

// 3. currentCash subtract savings
const currentCashOld = `    const currentCash = initialCash
      + Number(row.total_income || 0)
      - Number(row.total_expense || 0)
      - Number(row.total_invest_buy || 0)
      + Number(row.total_invest_sell || 0)
      + totalAdjustment;`;
const currentCashNew = `    const currentCash = initialCash
      + Number(row.total_income || 0)
      - Number(row.total_expense || 0)
      - (savingsRecordsTotal + savingsFromExpensesTotal)
      - Number(row.total_invest_buy || 0)
      + Number(row.total_invest_sell || 0)
      + totalAdjustment;`;

content = content.replace(currentCashOld, currentCashNew);

// 4. cumulativeCash before year
const beforeYearQueryEnd = `    const beforeYear = beforeYearQuery.rows[0] || {};`;
const beforeYearAssets = `
    const beforeYearAssetsQuery = await pool.query(
      \`SELECT
        (SELECT COALESCE(SUM(CASE WHEN type = 'withdraw' THEN -amount ELSE amount END), 0) FROM savings_records WHERE make_date(year::integer, month::integer, 1) >= $1::date AND make_date(year::integer, month::integer, 1) < $2::date AND \${filter3.where}) as savings_records_total,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND category = 'Tiết kiệm' AND linked_savings_id IS NULL AND \${transactionDateExpr} >= $1::date AND \${transactionDateExpr} < $2::date AND \${filter3.where}) as unlinked_savings_expense_total\`,
      [settings.trackingStartDate, yearStartDate, ...filter3.params]
    );
    const beforeYearAssetsData = beforeYearAssetsQuery.rows[0] || {};
    const beforeYearSavings = Number(beforeYearAssetsData.savings_records_total || 0) + Number(beforeYearAssetsData.unlinked_savings_expense_total || 0);
`;

content = content.replace(beforeYearQueryEnd, beforeYearQueryEnd + beforeYearAssets);

const cumulativeCashOld = `    let cumulativeCash = initialCash
      + Number(beforeYear.total_income || 0)
      - Number(beforeYear.total_expense || 0)
      - Number(beforeYear.total_invest_buy || 0)
      + Number(beforeYear.total_invest_sell || 0)
      + Number(beforeYear.total_adjustment || 0);`;
const cumulativeCashNew = `    let cumulativeCash = initialCash
      + Number(beforeYear.total_income || 0)
      - Number(beforeYear.total_expense || 0)
      - beforeYearSavings
      - Number(beforeYear.total_invest_buy || 0)
      + Number(beforeYear.total_invest_sell || 0)
      + Number(beforeYear.total_adjustment || 0);`;

content = content.replace(cumulativeCashOld, cumulativeCashNew);

// 5. monthlyData
const monthlyCashFlowOld = `const monthlyCashFlow = afterExpense - item.investmentBuy + item.investmentSell + item.adjustment;`;
const monthlyCashFlowNew = `const monthlyCashFlow = afterExpense - item.savingsInExpense - item.investmentBuy + item.investmentSell + item.adjustment;`;
content = content.replace(monthlyCashFlowOld, monthlyCashFlowNew);

// Fix estimatedAssets since currentCash definition moved AFTER it
// We need to re-assign estimatedAssets after currentCash is defined.
const estimatedAssetsOld = `const estimatedAssets = currentCash + currentSavings + currentInvestment;`;
content = content.replace(estimatedAssetsOld, `// moved below`);

const currentCashNew2 = `    const currentCash = initialCash
      + Number(row.total_income || 0)
      - Number(row.total_expense || 0)
      - (savingsRecordsTotal + savingsFromExpensesTotal)
      - Number(row.total_invest_buy || 0)
      + Number(row.total_invest_sell || 0)
      + totalAdjustment;
    
    const estimatedAssets = currentCash + currentSavings + currentInvestment;`;
content = content.replace(currentCashNew, currentCashNew2);

fs.writeFileSync(file, content);
console.log('API logic fixed.');
