const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_sig = `export function calculateMonthlyUsableBalanceInfo(
  month: number,
  year: number,
  transactions: any[],
  incomes: any[],
  memberId: string = "all"
) {`;

const r_sig = `export function calculateMonthlyUsableBalanceInfo(
  month: number,
  year: number,
  transactions: any[],
  incomes: any[],
  memberId: string = "all",
  settings?: any
) {
  const trackingStartMonth = Number(settings?.trackingStartMonth || 1);
  const trackingStartYear = Number(settings?.trackingStartYear || 2024);
  const trackingStartDate = new Date(trackingStartYear, trackingStartMonth - 1, 1);
  const openingCashBalance = Number(settings?.openingCashBalance || 0);
`;

const t_begin_bal = `  let beginningBalance = 0;
  
  // Sum past incomes
  toArray(incomes).forEach((inc: any) => {
    const d = new Date(inc.incomeDate || inc.receivedDate || inc.createdAt || inc.created_at || "");
    const mid = inc.memberId || inc.member_id;
    if (memberId !== "all" && mid !== memberId) return;
    if (!isNaN(d.getTime()) && d < currentMonthDate) {
       beginningBalance += Number(inc.amount) || 0;
    }
  });

  // Subtract past expenses and savings
  toArray(transactions).forEach((t: any) => {
    const isExpense = String(t.type).toLowerCase() === "expense" || Number(t.amount) < 0;
    if (!isExpense) return;
    
    // Ignore pending credit transactions or transactions already transferred to pending
    if (t.status === "pending" || t.excludedFromExpense || t.excluded_from_expense) return;
    
    // Do not subtract savings
    if (isSavingTransaction(t)) return;

    const d = getFinanceDate(t);
    const mid = t.memberId || t.member_id || t.userId || t.user_id;
    if (memberId !== "all" && mid && mid !== memberId) return;
    
    if (!isNaN(d.getTime()) && d < currentMonthDate) {
       beginningBalance -= Math.abs(Number(t.amount) || 0);
    }
  });`;

const r_begin_bal = `  let beginningBalance = openingCashBalance;
  
  // Sum past incomes
  toArray(incomes).forEach((inc: any) => {
    const d = new Date(inc.incomeDate || inc.receivedDate || inc.createdAt || inc.created_at || "");
    const mid = inc.memberId || inc.member_id;
    if (memberId !== "all" && mid !== memberId) return;
    // Only count from trackingStartDate up to currentMonthDate
    if (!isNaN(d.getTime()) && d >= trackingStartDate && d < currentMonthDate) {
       beginningBalance += Number(inc.amount) || 0;
    }
  });

  // Subtract past expenses and savings
  toArray(transactions).forEach((t: any) => {
    const isExpense = String(t.type).toLowerCase() === "expense" || Number(t.amount) < 0;
    if (!isExpense) return;
    
    // Ignore pending credit transactions or transactions already transferred to pending
    if (t.status === "pending" || t.excludedFromExpense || t.excluded_from_expense) return;

    const d = getFinanceDate(t);
    const mid = t.memberId || t.member_id || t.userId || t.user_id;
    if (memberId !== "all" && mid && mid !== memberId) return;
    
    if (!isNaN(d.getTime()) && d >= trackingStartDate && d < currentMonthDate) {
       beginningBalance -= Math.abs(Number(t.amount) || 0);
    }
  });`;

const t_avail = `  const availableThisMonth = beginningBalance + summary.incomeTotal - trueExpenseThisMonth;`;
const r_avail = `  const availableThisMonth = beginningBalance + summary.incomeTotal - trueExpenseThisMonth - savingsThisMonth;`;

const t_total_money = `  let totalMoneyOnHand = 0;
  toArray(incomes).forEach((inc: any) => {
    const mid = inc.memberId || inc.member_id;
    if (memberId !== "all" && mid !== memberId) return;
    totalMoneyOnHand += Number(inc.amount) || 0;
  });
  toArray(transactions).forEach((t: any) => {
    const isExpense = String(t.type).toLowerCase() === "expense" || Number(t.amount) < 0;
    if (!isExpense || t.status === "pending" || t.excludedFromExpense || t.excluded_from_expense) return;
    if (isSavingTransaction(t)) return;
    const mid = t.memberId || t.member_id || t.userId || t.user_id;
    if (memberId !== "all" && mid && mid !== memberId) return;
    totalMoneyOnHand -= Math.abs(Number(t.amount) || 0);
  });`;

const r_total_money = `  let totalMoneyOnHand = openingCashBalance;
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
  });`;

const t_calc_bal = `export function calculateMonthlyUsableBalance(
  month: number,
  year: number,
  transactions: any[],
  incomes: any[],
  memberId: string = "all"
) {
  return calculateMonthlyUsableBalanceInfo(month, year, transactions, incomes, memberId).availableThisMonth;
}`;

const r_calc_bal = `export function calculateMonthlyUsableBalance(
  month: number,
  year: number,
  transactions: any[],
  incomes: any[],
  memberId: string = "all",
  settings?: any
) {
  return calculateMonthlyUsableBalanceInfo(month, year, transactions, incomes, memberId, settings).availableThisMonth;
}`;

let hasError = false;
if (!content.includes(t_sig)) { console.log("t_sig missing"); hasError = true; }
if (!content.includes(t_begin_bal)) { console.log("t_begin_bal missing"); hasError = true; }
if (!content.includes(t_avail)) { console.log("t_avail missing"); hasError = true; }
if (!content.includes(t_total_money)) { console.log("t_total_money missing"); hasError = true; }
if (!content.includes(t_calc_bal)) { console.log("t_calc_bal missing"); hasError = true; }

if (hasError) process.exit(1);

content = content.replace(t_sig, r_sig);
content = content.replace(t_begin_bal, r_begin_bal);
content = content.replace(t_avail, r_avail);
content = content.replace(t_total_money, r_total_money);
content = content.replace(t_calc_bal, r_calc_bal);

fs.writeFileSync(file, content);
console.log("Replaced successfully");
