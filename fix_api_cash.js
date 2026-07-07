const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// Fix currentCash and cumulativeCash logic in backend
const t_currentCash = `      const currentCash = settings.openingCashBalance
        + Number(row.total_income || 0)
        - Number(row.total_expense || 0)
        - savingsRecordsTotal
        - savingsFromExpensesTotal
        - investmentBuyTotal
        + investmentSellTotal
        + Number(row.total_adjustment || 0);`;

const r_currentCash = `      const currentCash = totalOpeningCash
        + Number(row.total_income || 0)
        - Number(row.total_expense || 0)
        - savingsRecordsTotal
        - savingsFromExpensesTotal
        - investmentBuyTotal
        + investmentSellTotal
        + Number(row.total_adjustment || 0);`;
content = content.replace(t_currentCash, r_currentCash);

const t_cumulativeCash = `      let cumulativeCash = settings.openingCashBalance
        + Number(beforeYear.total_income || 0)
        - Number(beforeYear.total_expense || 0)
        - Number(beforeYear.total_savings_records || 0)
        - Number(beforeYear.total_savings_expense || 0)
        - Number(beforeYear.total_invest_buy || 0)
        + Number(beforeYear.total_invest_sell || 0)
        + Number(beforeYear.total_adjustment || 0);`;

const r_cumulativeCash = `      let cumulativeCash = totalOpeningCash
        + Number(beforeYear.total_income || 0)
        - Number(beforeYear.total_expense || 0)
        - Number(beforeYear.total_savings_records || 0)
        - Number(beforeYear.total_savings_expense || 0)
        - Number(beforeYear.total_invest_buy || 0)
        + Number(beforeYear.total_invest_sell || 0)
        + Number(beforeYear.total_adjustment || 0);`;
content = content.replace(t_cumulativeCash, r_cumulativeCash);

fs.writeFileSync(file, content);
console.log("Patched API logic");
