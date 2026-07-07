const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_finance_row = `                const cumulativeCash = item.cumulativeCash ?? 0;
                return (
                  <tr key={item.month} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold">Tháng {item.month}</td>
                    <td className="px-4 py-3 text-right text-emerald-500">{money(income)}</td>
                    <td className="px-4 py-3 text-right text-rose-500">{money(expense)}</td>
                    <td className="px-4 py-3 text-right font-medium">{money(duSauChi)}</td>
                    <td className="px-4 py-3 text-right text-blue-500">{money(savingsInExpense)}</td>
                    <td className="px-4 py-3 text-right text-purple-500">{money(netInvestment)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-200">{money(conLai)}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-600">{money(cumulativeCash)}</td>
                  </tr>
                );`;

const r_finance_row = `                const cumulativeCash = item.cumulativeCash;
                const isFuture = item.isFuture;
                const isCurrent = item.isCurrent;
                return (
                  <tr key={item.month} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold">Tháng {item.month}</td>
                    <td className="px-4 py-3 text-right text-emerald-500">{money(income)}</td>
                    <td className="px-4 py-3 text-right text-rose-500">{money(expense)}</td>
                    <td className="px-4 py-3 text-right font-medium">{money(duSauChi)}</td>
                    <td className="px-4 py-3 text-right text-blue-500">{money(savingsInExpense)}</td>
                    <td className="px-4 py-3 text-right text-purple-500">{money(netInvestment)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-200">{isFuture ? "-" : money(conLai)}</td>
                    <td className="px-4 py-3 text-right font-bold text-indigo-600">{isFuture ? <span className="text-slate-400 font-normal">Chưa tới</span> : isCurrent ? <span className="text-emerald-600">Hiện tại: {money(cumulativeCash ?? 0)}</span> : money(cumulativeCash ?? 0)}</td>
                  </tr>
                );`;

let hasError = false;
if (!content.includes(t_finance_row)) { console.log("t_finance_row missing"); hasError = true; }

if (hasError) process.exit(1);

content = content.replace(t_finance_row, r_finance_row);

fs.writeFileSync(file, content);
console.log("Patched FinanceDashboard table row");
