const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1. Fix beginningBalance
const t_begin_bal = `    // Ignore pending credit transactions or transactions already transferred to pending
    if (t.status === "pending" || t.excludedFromExpense || t.excluded_from_expense) return;

    const d = getFinanceDate(t);`;

const r_begin_bal = `    // Ignore pending credit transactions or transactions already transferred to pending
    if (t.status === "pending" || t.excludedFromExpense || t.excluded_from_expense) return;
    
    // Do not subtract savings
    if (isSavingTransaction(t)) return;

    const d = getFinanceDate(t);`;

// 2. Fix availableThisMonth
const t_avail = `const availableThisMonth = beginningBalance + summary.incomeTotal - trueExpenseThisMonth - savingsThisMonth;`;
const r_avail = `const availableThisMonth = beginningBalance + summary.incomeTotal - trueExpenseThisMonth;`;

// 3. Fix totalMoneyOnHand
const t_total_money = `    if (!isExpense || t.status === "pending" || t.excludedFromExpense || t.excluded_from_expense) return;
    const mid = t.memberId || t.member_id || t.userId || t.user_id;`;
const r_total_money = `    if (!isExpense || t.status === "pending" || t.excludedFromExpense || t.excluded_from_expense) return;
    if (isSavingTransaction(t)) return;
    const mid = t.memberId || t.member_id || t.userId || t.user_id;`;

// 4. Fix UI Box "Chi thật tháng này"
const t_ui_box = `<span className="font-semibold text-[#171018]">{money(monthlyInfo.expenseTotal + monthlyInfo.savingsTotal)}</span>`;
const r_ui_box = `<span className="font-semibold text-[#171018]">{money(monthlyInfo.expenseTotal)}</span>`;

let hasError = false;
if (!content.includes(t_begin_bal)) { console.log("t_begin_bal missing"); hasError = true; }
if (!content.includes(t_avail)) { console.log("t_avail missing"); hasError = true; }
if (!content.includes(t_total_money)) { console.log("t_total_money missing"); hasError = true; }
if (!content.includes(t_ui_box)) { console.log("t_ui_box missing"); hasError = true; }

if (hasError) process.exit(1);

content = content.replace(t_begin_bal, r_begin_bal);
content = content.replace(t_avail, r_avail);
content = content.replace(t_total_money, r_total_money);
content = content.replace(t_ui_box, r_ui_box);

fs.writeFileSync(file, content);
console.log("Replaced successfully");
