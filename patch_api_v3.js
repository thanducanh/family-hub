const fs = require('fs');

let c = fs.readFileSync('src/app/api/finance-overview/route.ts', 'utf8');

// 1. initialCash
c = c.replace(/const currentCash = settings\.openingCashBalance\s*\+\s*Number\(row\.total_income \|\| 0\)\s*\-\s*Number\(row\.total_expense \|\| 0\)\s*\-\s*Number\(row\.total_invest_buy \|\| 0\)\s*\+\s*Number\(row\.total_invest_sell \|\| 0\)\s*\+\s*totalAdjustment;/, `const hasNewFields = settings.openingCashAmount !== undefined && settings.openingCashAmount !== null;
    const initialCash = hasNewFields 
      ? ((settings.openingCashAmount || 0) + (settings.openingDebitAmount || 0) + (settings.openingWalletAmount || 0)) 
      : (settings.openingCashBalance || 0);

    const currentCash = initialCash
      + Number(row.total_income || 0)
      - Number(row.total_expense || 0)
      - Number(row.total_invest_buy || 0)
      + Number(row.total_invest_sell || 0)
      + totalAdjustment;`);

// 2. assetsQuery and currentCash properly defined afterwards
const assetsQueryRegex = /const assetsQuery = await pool\.query\([\s\S]*?const estimatedAssets = currentCash \+ currentSavings \+ currentInvestment;/;
const matchAssets = c.match(assetsQueryRegex);
if (matchAssets) {
  let assetsBlock = matchAssets[0];
  assetsBlock = assetsBlock.replace('const estimatedAssets = currentCash + currentSavings + currentInvestment;', `const estimatedAssets = currentCash + currentSavings + currentInvestment;`);
  
  // We need to redefine currentCash AFTER assetsQuery
  // The simplest way is to remove currentCash from before assetsQuery and put it after.
}
// Actually, it's easier to just split by lines and insert manually.
let lines = c.split('\n');

// Find currentCash block
let ccIndex = lines.findIndex(l => l.includes('const currentCash = initialCash'));
if (ccIndex !== -1) {
  // Remove the old currentCash block
  lines.splice(ccIndex, 6);
  
  // Find estimatedAssets
  let eaIndex = lines.findIndex(l => l.includes('const estimatedAssets = currentCash + currentSavings + currentInvestment;'));
  
  // Insert currentCash right before estimatedAssets
  lines.splice(eaIndex, 0, `    const currentCash = initialCash
      + Number(row.total_income || 0)
      - Number(row.total_expense || 0)
      - (savingsRecordsTotal + savingsFromExpensesTotal)
      - Number(row.total_invest_buy || 0)
      + Number(row.total_invest_sell || 0)
      + totalAdjustment;`);
}

c = lines.join('\n');

// 3. beforeYearQuery to include savings
c = c.replace(/const beforeYear = beforeYearQuery\.rows\[0\] \|\| \{\};/, `const beforeYear = beforeYearQuery.rows[0] || {};
    const beforeYearAssetsQuery = await pool.query(
      \`SELECT
        (SELECT COALESCE(SUM(CASE WHEN type = 'withdraw' THEN -amount ELSE amount END), 0) FROM savings_records WHERE make_date(year::integer, month::integer, 1) >= $1::date AND make_date(year::integer, month::integer, 1) < $2::date AND \${filter3.where}) as savings_records_total,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'expense' AND category = 'Tiết kiệm' AND linked_savings_id IS NULL AND \${transactionDateExpr} >= $1::date AND \${transactionDateExpr} < $2::date AND \${filter3.where}) as unlinked_savings_expense_total\`,
      [settings.trackingStartDate, yearStartDate, ...filter3.params]
    );
    const beforeYearAssets = beforeYearAssetsQuery.rows[0] || {};
    const beforeYearSavings = Number(beforeYearAssets.savings_records_total || 0) + Number(beforeYearAssets.unlinked_savings_expense_total || 0);`);

c = c.replace(/let cumulativeCash = settings\.openingCashBalance\s*\+\s*Number\(beforeYear\.total_income \|\| 0\)\s*\-\s*Number\(beforeYear\.total_expense \|\| 0\)\s*\-\s*Number\(beforeYear\.total_invest_buy \|\| 0\)\s*\+\s*Number\(beforeYear\.total_invest_sell \|\| 0\)\s*\+\s*Number\(beforeYear\.total_adjustment \|\| 0\);/, `let cumulativeCash = initialCash
      + Number(beforeYear.total_income || 0)
      - Number(beforeYear.total_expense || 0)
      - beforeYearSavings
      - Number(beforeYear.total_invest_buy || 0)
      + Number(beforeYear.total_invest_sell || 0)
      + Number(beforeYear.total_adjustment || 0);`);

// 4. monthlyCashFlow includes savings
c = c.replace(/const monthlyCashFlow = afterExpense - item\.investmentBuy \+ item\.investmentSell \+ item\.adjustment;/, `const monthlyCashFlow = afterExpense - item.savingsInExpense - item.investmentBuy + item.investmentSell + item.adjustment;`);

// 5. Future months handling
c = c.replace(/const inTrackingRange = year > settings\.trackingStartYear \|\| \(year === settings\.trackingStartYear && item\.month >= settings\.trackingStartMonth\);\s*if \(inTrackingRange\) cumulativeCash \+= monthlyCashFlow;\s*return \{ \.\.\.item, netInvestment, afterExpense, monthlyCashFlow, cumulativeCash \};/, `const inTrackingRange = year > settings.trackingStartYear || (year === settings.trackingStartYear && item.month >= settings.trackingStartMonth);
      if (inTrackingRange) cumulativeCash += monthlyCashFlow;
      const currentRealMonth = new Date().getMonth() + 1;
      const currentRealYear = new Date().getFullYear();
      const isFuture = year > currentRealYear || (year === currentRealYear && item.month > currentRealMonth);
      return { ...item, netInvestment, afterExpense, monthlyCashFlow, cumulativeCash: isFuture ? null : cumulativeCash };`);

// 6. Global pending credit replacement.
// Let's insert it before the LAST return NextResponse.json
const parts = c.split('return NextResponse.json({');
const lastPartIndex = parts.length - 2; // the actual JSON object starts at length-1 (since length-2 is the text before the last return and the catch block return is the LAST one).
// Wait, catch block return is the very last one. 
// Let's just find `return NextResponse.json({\n      ok: true,\n      data: {`
c = c.replace(/return NextResponse\.json\(\{\s*ok: true,\s*data: \{/, `    const paramsPending = ['pending'];
    let wherePending = "status = $1";
    if (filter.params[0]) {
      paramsPending.push(filter.params[0]);
      wherePending += " AND member_id = $2";
    }
    const globalPendingCreditQuery = await pool.query(\`SELECT SUM(amount) as total FROM card_pending_transactions WHERE \${wherePending}\`, paramsPending);
    const pendingCreditTotal = Number(globalPendingCreditQuery.rows[0]?.total || 0);
    
    return NextResponse.json({
      ok: true,
      data: {
        pendingCreditTotal,`);

c = c.replace(/openingCashBalance: settings\.openingCashBalance/g, 'openingCashBalance: initialCash');

fs.writeFileSync('src/app/api/finance-overview/route.ts', c);
console.log('Patched finance-overview/route.ts successfully.');
