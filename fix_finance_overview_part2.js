const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// currentCash
const t_currentCash = `    const currentCash = settings.openingCashBalance
      + Number(row.total_income || 0)
      - Number(row.total_expense || 0)
      - savingsRecordsTotal
      - savingsFromExpensesTotal
      - Number(row.total_invest_buy || 0)
      + Number(row.total_invest_sell || 0)
      + totalAdjustment;`;
const r_currentCash = `    const currentCash = settings.totalOpeningCash
      + Number(row.total_income || 0)
      - Number(row.total_expense || 0)
      - savingsRecordsTotal
      - savingsFromExpensesTotal
      - Number(row.total_invest_buy || 0)
      + Number(row.total_invest_sell || 0)
      + totalAdjustment;`;
content = content.replace(t_currentCash, r_currentCash);

// cumulativeCash
const t_cumulativeCash = `    let cumulativeCash = settings.openingCashBalance
      + Number(beforeYear.total_income || 0)
      - Number(beforeYear.total_expense || 0)
      - Number(beforeYear.total_savings_records || 0)
      - Number(beforeYear.total_savings_expense || 0)
      - Number(beforeYear.total_invest_buy || 0)
      + Number(beforeYear.total_invest_sell || 0)
      + Number(beforeYear.total_adjustment || 0);`;
const r_cumulativeCash = `    let cumulativeCash = settings.totalOpeningCash
      + Number(beforeYear.total_income || 0)
      - Number(beforeYear.total_expense || 0)
      - Number(beforeYear.total_savings_records || 0)
      - Number(beforeYear.total_savings_expense || 0)
      - Number(beforeYear.total_invest_buy || 0)
      + Number(beforeYear.total_invest_sell || 0)
      + Number(beforeYear.total_adjustment || 0);`;
content = content.replace(t_cumulativeCash, r_cumulativeCash);

// cashBreakdown
const t_cashBreakdown = `            openingCashBalance: settings.openingCashBalance,`;
const r_cashBreakdown = `            openingCashBalance: settings.totalOpeningCash,`;
content = content.replace(t_cashBreakdown, r_cashBreakdown);

let hasError = false;
if (!content.includes(r_currentCash)) { console.log("currentCash missing"); hasError = true; }
if (!content.includes(r_cumulativeCash)) { console.log("cumulativeCash missing"); hasError = true; }
if (!content.includes(r_cashBreakdown)) { console.log("cashBreakdown missing"); hasError = true; }
if (hasError) process.exit(1);

fs.writeFileSync(file, content);
console.log("Patched finance-overview remaining usages");
