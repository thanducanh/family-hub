const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `  const monthlyInfo = calculateMonthlyUsableBalanceInfo(month, year, toArray(appData?.transactions), toArray(incomes), "all");`;

const replacement = `  const currentMonthDate = new Date(year, month - 1, 1);
  const trackingStartMonth = Number(overviewData?.settings?.trackingStartMonth || 7);
  const trackingStartYear = Number(overviewData?.settings?.trackingStartYear || 2026);
  const trackingStartDate = new Date(trackingStartYear, trackingStartMonth - 1, 1);
  const isHistorical = currentMonthDate < trackingStartDate;

  const summary = getMonthlyFinanceSummary(toArray(appData?.transactions), toArray(incomes), month, year, "all");
  const savingsTotal = toArray(appData?.transactions).filter((t: any) => (String(t.type).toLowerCase() === "expense" || Number(t.amount) < 0) && isSavingTransaction(t)).filter((t: any) => { const d = getFinanceDate(t); return !Number.isNaN(d.getTime()) && d.getMonth() === month - 1 && d.getFullYear() === year; }).reduce((s: number, t: any) => s + Math.abs(Number(t.amount) || 0), 0);
  
  let beginningBalance = 0;
  if (!isHistorical) {
    beginningBalance = Number(overviewData?.settings?.openingCashAmount || 0) + Number(overviewData?.settings?.openingDebitAmount || 0) + Number(overviewData?.settings?.openingWalletAmount || 0);
    toArray(incomes).forEach((inc: any) => {
      const d = new Date(inc.incomeDate || inc.receivedDate || inc.createdAt || inc.created_at || "");
      if (!isNaN(d.getTime()) && d >= trackingStartDate && d < currentMonthDate) {
        beginningBalance += Number(inc.amount) || 0;
      }
    });
    toArray(appData?.transactions).forEach((t: any) => {
      const isExpense = String(t.type).toLowerCase() === "expense" || Number(t.amount) < 0;
      if (!isExpense || t.status === "pending" || t.excludedFromExpense || t.excluded_from_expense) return;
      const d = getFinanceDate(t);
      if (!isNaN(d.getTime()) && d >= trackingStartDate && d < currentMonthDate) {
        beginningBalance -= Math.abs(Number(t.amount) || 0);
      }
    });
  }

  const expenseTotal = summary.expenseTotal - savingsTotal;
  const availableThisMonth = beginningBalance + summary.incomeTotal - expenseTotal - savingsTotal;

  const monthlyInfo = {
    isHistorical,
    beginningBalance,
    incomeTotal: summary.incomeTotal,
    expenseTotal,
    savingsTotal,
    availableThisMonth
  };`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
console.log("Replaced monthlyInfo");
