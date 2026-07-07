const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// FinanceDashboard availableThisMonth
const t_availDash = `  const availableThisMonth = Number(currentMonthData.monthlyCashFlow ?? (Number(currentMonthData.income || 0) - Number(currentMonthData.expense || 0) - Number(currentMonthData.savingsInExpense || 0) - Number(currentMonthData.investmentBuy || 0) + Number(currentMonthData.investmentSell || 0) + Number(currentMonthData.adjustment || 0)));`;

const r_availDash = `  const availableThisMonth = Number(currentMonthData.cumulativeCash ?? 0);`;

let hasError = false;
if (!content.includes(t_availDash)) { console.log("t_availDash missing"); hasError = true; }

if (hasError) process.exit(1);

content = content.replace(t_availDash, r_availDash);

fs.writeFileSync(file, content);
console.log("Patched FinanceDashboard availableThisMonth");
