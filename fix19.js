const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_overview12Months = `  const overview12Months = yearMonths.map(m => {
    const sum = getMonthlyFinanceSummary(data.transactions || [], incomesRecords, m, selectedYear, "all");
    const sav = getSavings(m, selectedYear, "all");
    return {
      month: m,
      Thu: sum.incomeTotal,
      Chi: sum.expenseTotal,
      TietKiem: sav,
      ConLai: calculateMonthlyUsableBalance(m, selectedYear, data.transactions || [], incomesRecords, "all", overviewData?.settings)
    };
  });`;

const r_overview12Months = `  const overview12Months = yearMonths.map(m => {
    const sum = getMonthlyFinanceSummary(data.transactions || [], incomesRecords, m, selectedYear, "all");
    const sav = getSavings(m, selectedYear, "all");
    
    const isFuture = selectedYear > now.getFullYear() || (selectedYear === now.getFullYear() && m > now.getMonth() + 1);
    const isCurrent = selectedYear === now.getFullYear() && m === now.getMonth() + 1;

    return {
      month: m,
      Thu: sum.incomeTotal,
      Chi: sum.expenseTotal,
      TietKiem: sav,
      ConLai: isFuture ? 0 : calculateMonthlyUsableBalance(m, selectedYear, data.transactions || [], incomesRecords, "all", overviewData?.settings),
      isFuture,
      isCurrent
    };
  });`;

let hasError = false;
if (!content.includes(t_overview12Months)) { console.log("t_overview12Months missing"); hasError = true; }
if (hasError) process.exit(1);

content = content.replace(t_overview12Months, r_overview12Months);

fs.writeFileSync(file, content);
console.log("Patched overview12Months");
