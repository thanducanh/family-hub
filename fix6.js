const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_card_type = `function normalizeCardType(cardType: string | undefined | null) {
  const t = String(cardType || "").toLowerCase().trim();
  if (t === "credit" || t === "thẻ tín dụng") return "credit";
  if (t === "debit" || t === "thẻ ghi nợ" || t === "thẻ ghi nợ / atm") return "debit";
  return t;
}

function isActiveBankAccount(status: string | undefined | null) {
  const s = String(status || "").toLowerCase().trim();
  return s === "active" || s === "đang dùng" || s === "enabled";
}`;

const r_card_type = `function normalizeCardType(cardType: string | undefined | null) {
  const t = String(cardType || "").toLowerCase().trim();
  if (t === "credit" || t === "thẻ tín dụng") return "credit";
  if (t === "debit" || t === "thẻ ghi nợ" || t === "thẻ ghi nợ / atm") return "debit";
  if (t === "bank_account" || t === "tài khoản ngân hàng") return "bank_account";
  if (t === "wallet" || t === "ví điện tử") return "wallet";
  if (t === "cash" || t === "tiền mặt") return "cash";
  return t;
}

function isActiveBankAccount(status: string | undefined | null) {
  const s = String(status || "").toLowerCase().trim();
  return s === "active" || s === "đang dùng" || s === "enabled";
}

function isPaymentSourceForCreditCard(account: any) {
  if (!account) return false;
  if (!isActiveBankAccount(account.status)) return false;
  const type = normalizeCardType(account.cardType);
  return type === "debit" || type === "bank_account" || type === "wallet" || type === "cash";
}`;

const t_balance = `export function calculateMonthlyUsableBalance(
  month: number,
  year: number,
  transactions: any[],
  incomes: any[],
  memberId: string = "all"
) {
  const summary = getMonthlyFinanceSummary(transactions, incomes, month, year, memberId);
  const savings = toArray(transactions)
    .filter((t: any) => (String(t.type).toLowerCase() === "expense" || Number(t.amount) < 0) && isSavingTransaction(t))
    .filter((t: any) => {
      const d = getFinanceDate(t);
      const mid = t.memberId || t.member_id || t.userId || t.user_id;
      return !Number.isNaN(d.getTime()) && d.getMonth() === month - 1 && d.getFullYear() === year
        && (memberId === "all" || !mid || mid === memberId);
    })
    .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount) || 0), 0);

  const investment = 0;
  const adjustment = 0;
  return summary.incomeTotal - summary.expenseTotal - savings - investment + adjustment;
}`;

const r_balance = `export function calculateMonthlyUsableBalanceInfo(
  month: number,
  year: number,
  transactions: any[],
  incomes: any[],
  memberId: string = "all"
) {
  const currentMonthDate = new Date(year, month - 1, 1);

  let beginningBalance = 0;
  
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

    const d = getFinanceDate(t);
    const mid = t.memberId || t.member_id || t.userId || t.user_id;
    if (memberId !== "all" && mid && mid !== memberId) return;
    
    if (!isNaN(d.getTime()) && d < currentMonthDate) {
       beginningBalance -= Math.abs(Number(t.amount) || 0);
    }
  });

  const summary = getMonthlyFinanceSummary(transactions, incomes, month, year, memberId);
  const savingsThisMonth = toArray(transactions)
    .filter((t: any) => (String(t.type).toLowerCase() === "expense" || Number(t.amount) < 0) && isSavingTransaction(t) && !t.excludedFromExpense && !t.excluded_from_expense)
    .filter((t: any) => {
      const d = getFinanceDate(t);
      const mid = t.memberId || t.member_id || t.userId || t.user_id;
      return !Number.isNaN(d.getTime()) && d.getMonth() === month - 1 && d.getFullYear() === year
        && (memberId === "all" || !mid || mid === memberId);
    })
    .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount) || 0), 0);
    
  // Need to subtract true expenses (excluding pending) this month
  const trueExpenseThisMonth = toArray(transactions)
    .filter((t: any) => (String(t.type).toLowerCase() === "expense" || Number(t.amount) < 0) && !isSavingTransaction(t) && !t.excludedFromExpense && !t.excluded_from_expense)
    .filter((t: any) => {
      const d = getFinanceDate(t);
      const mid = t.memberId || t.member_id || t.userId || t.user_id;
      return !Number.isNaN(d.getTime()) && d.getMonth() === month - 1 && d.getFullYear() === year
        && (memberId === "all" || !mid || mid === memberId);
    })
    .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount) || 0), 0);

  const availableThisMonth = beginningBalance + summary.incomeTotal - trueExpenseThisMonth - savingsThisMonth;

  let totalMoneyOnHand = 0;
  toArray(incomes).forEach((inc: any) => {
    const mid = inc.memberId || inc.member_id;
    if (memberId !== "all" && mid !== memberId) return;
    totalMoneyOnHand += Number(inc.amount) || 0;
  });
  toArray(transactions).forEach((t: any) => {
    const isExpense = String(t.type).toLowerCase() === "expense" || Number(t.amount) < 0;
    if (!isExpense || t.status === "pending" || t.excludedFromExpense || t.excluded_from_expense) return;
    const mid = t.memberId || t.member_id || t.userId || t.user_id;
    if (memberId !== "all" && mid && mid !== memberId) return;
    totalMoneyOnHand -= Math.abs(Number(t.amount) || 0);
  });

  return {
    beginningBalance,
    incomeTotal: summary.incomeTotal,
    expenseTotal: trueExpenseThisMonth,
    savingsTotal: savingsThisMonth,
    availableThisMonth,
    totalMoneyOnHand
  };
}

export function calculateMonthlyUsableBalance(
  month: number,
  year: number,
  transactions: any[],
  incomes: any[],
  memberId: string = "all"
) {
  return calculateMonthlyUsableBalanceInfo(month, year, transactions, incomes, memberId).availableThisMonth;
}`;

const t_list = `  const availableThisMonth = calculateMonthlyUsableBalance(month, year, toArray(appData?.transactions), toArray(incomes), "all");

  const displayList = monthItems.filter(item => subTab === "all" || (subTab === "income" ? item._isIncome : !item._isIncome));`;

const r_list = `  const monthlyInfo = calculateMonthlyUsableBalanceInfo(month, year, toArray(appData?.transactions), toArray(incomes), "all");
  const availableThisMonth = monthlyInfo.availableThisMonth;

  const displayList = monthItems.filter(item => subTab === "all" || (subTab === "income" ? item._isIncome : !item._isIncome));`;

const t_ui = `    <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
      <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Có thể dùng tháng này</p>
      <b className={\`block break-words text-[clamp(23px,7.5vw,31px)] font-bold leading-tight tracking-tight \${availableThisMonth >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>{money(availableThisMonth)}</b>
      <p className="mb-3 mt-2 text-[11px] leading-4 text-[#6B5E64]">Tiền đang có hiện tại: <span className="font-semibold text-[#171018]">{loadingOverview ? "..." : (overviewDataCache[year] ? money(totalMoneyOnHand) : "-")}</span></p>
      
      <div className="grid grid-cols-3 border-t border-[#E8DCD5] pt-3 gap-1">`;

const r_ui = `    <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
      <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Có thể dùng tháng này</p>
      <b className={\`block break-words text-[clamp(23px,7.5vw,31px)] font-bold leading-tight tracking-tight \${availableThisMonth >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>{money(availableThisMonth)}</b>
      
      <div className="mt-3 mb-4 space-y-1.5 text-[12px] text-[#6B5E64]">
        <div className="flex justify-between items-center">
          <span>Dư đầu tháng:</span>
          <span className="font-semibold text-[#171018]">{money(monthlyInfo.beginningBalance)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Thu tháng này:</span>
          <span className="font-semibold text-[#171018]">{money(monthlyInfo.incomeTotal)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Chi thật tháng này:</span>
          <span className="font-semibold text-[#171018]">{money(monthlyInfo.expenseTotal + monthlyInfo.savingsTotal)}</span>
        </div>
        {pendingCredit > 0 && (
          <div className="flex justify-between items-center pt-1 mt-1 border-t border-[#E8DCD5]/50">
            <span className="text-[#800020]">Sau khi trả thẻ dự kiến:</span>
            <span className="font-bold text-[#800020]">{money(availableThisMonth - pendingCredit)}</span>
          </div>
        )}
      </div>

      <p className="mb-3 mt-2 text-[11px] leading-4 text-[#6B5E64] flex justify-between items-center">
        <span>Tiền đang có hiện tại:</span>
        <span className="font-semibold text-[#171018]">{loadingOverview ? "..." : money(monthlyInfo.totalMoneyOnHand)}</span>
      </p>
      
      <div className="grid grid-cols-3 border-t border-[#E8DCD5] pt-3 gap-1">`;

const t_filter = `  const activeSources = bankAccounts.filter(b => (b.status === "active" || b.status === "Đang dùng" || b.status === "enabled") && String(b.id) !== String(card.id));`;
const r_filter = `  const activeSources = bankAccounts.filter(b => isPaymentSourceForCreditCard(b) && String(b.id) !== String(card.id));`;

let hasError = false;
if (!content.includes(t_card_type)) { console.log("t_card_type missing"); hasError = true; }
if (!content.includes(t_balance)) { console.log("t_balance missing"); hasError = true; }
if (!content.includes(t_list)) { console.log("t_list missing"); hasError = true; }
if (!content.includes(t_ui)) { console.log("t_ui missing"); hasError = true; }
if (!content.includes(t_filter)) { console.log("t_filter missing"); hasError = true; }

if (hasError) process.exit(1);

content = content.replace(t_card_type, r_card_type);
content = content.replace(t_balance, r_balance);
content = content.replace(t_list, r_list);
content = content.replace(t_ui, r_ui);
content = content.replace(t_filter, r_filter);

fs.writeFileSync(file, content);
console.log("Replaced successfully");
