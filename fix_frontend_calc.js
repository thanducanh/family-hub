const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_calc = `  const availableThisMonth = beginningBalance + summary.incomeTotal - trueExpenseThisMonth - savingsThisMonth;
  
    let totalMoneyOnHand = openingCashBalance;
    toArray(incomes).forEach((inc: any) => {
      const d = new Date(inc.incomeDate || inc.receivedDate || inc.createdAt || inc.created_at || "");
      const mid = inc.memberId || inc.member_id;
      if (memberId !== "all" && mid !== memberId) return;
      if (!isNaN(d.getTime()) && d >= trackingStartDate) {
        totalMoneyOnHand += Number(inc.amount) || 0;
      }
    });
    toArray(transactions).forEach((t: any) => {
      const isExpense = String(t.type).toLowerCase() === "expense" || Number(t.amount) < 0;
      if (!isExpense || t.status === "pending" || t.excludedFromExpense || t.excluded_from_expense) return;
      const d = getFinanceDate(t);
      const mid = t.memberId || t.member_id || t.userId || t.user_id;
      if (memberId !== "all" && mid && mid !== memberId) return;
      if (!isNaN(d.getTime()) && d >= trackingStartDate) {
        totalMoneyOnHand -= Math.abs(Number(t.amount) || 0);
      }
    });
  
    return {
      beginningBalance,
      incomeTotal: summary.incomeTotal,
      expenseTotal: trueExpenseThisMonth,
      savingsTotal: savingsThisMonth,
      availableThisMonth,
      totalMoneyOnHand
    };`;

const r_calc = `  const isHistorical = currentMonthDate < trackingStartDate;

    const availableThisMonth = beginningBalance + summary.incomeTotal - trueExpenseThisMonth - savingsThisMonth;
  
    let totalMoneyOnHand = openingCashBalance;
    toArray(incomes).forEach((inc: any) => {
      const d = new Date(inc.incomeDate || inc.receivedDate || inc.createdAt || inc.created_at || "");
      const mid = inc.memberId || inc.member_id;
      if (memberId !== "all" && mid !== memberId) return;
      if (!isNaN(d.getTime()) && d >= trackingStartDate) {
        totalMoneyOnHand += Number(inc.amount) || 0;
      }
    });
    toArray(transactions).forEach((t: any) => {
      const isExpense = String(t.type).toLowerCase() === "expense" || Number(t.amount) < 0;
      if (!isExpense || t.status === "pending" || t.excludedFromExpense || t.excluded_from_expense) return;
      const d = getFinanceDate(t);
      const mid = t.memberId || t.member_id || t.userId || t.user_id;
      if (memberId !== "all" && mid && mid !== memberId) return;
      if (!isNaN(d.getTime()) && d >= trackingStartDate) {
        totalMoneyOnHand -= Math.abs(Number(t.amount) || 0);
      }
    });
  
    return {
      isHistorical,
      beginningBalance,
      incomeTotal: summary.incomeTotal,
      expenseTotal: trueExpenseThisMonth,
      savingsTotal: savingsThisMonth,
      availableThisMonth,
      totalMoneyOnHand
    };`;

content = content.replace(t_calc, r_calc);

fs.writeFileSync(file, content);
console.log("Patched calculateMonthlyUsableBalanceInfo");
