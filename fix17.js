const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// Patch overview12Months mapping
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

// Patch row rendering
const t_mobileStatsRow = `                      <div className="flex justify-between items-center mb-2 border-b border-[#F8F5F2] pb-2">
                        <span className="font-bold text-[14px] text-[#171018]">T{item.month}</span>
                        <span className={\`font-bold text-[13px] \${item.ConLai >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>Còn lại: {money(item.ConLai)}</span>
                      </div>`;

const r_mobileStatsRow = `                      <div className="flex justify-between items-center mb-2 border-b border-[#F8F5F2] pb-2">
                        <span className="font-bold text-[14px] text-[#171018]">T{item.month}</span>
                        {item.isFuture ? (
                          <span className="font-bold text-[13px] text-[#6B5E64]">Chưa tới tháng</span>
                        ) : item.isCurrent ? (
                          <span className={\`font-bold text-[13px] \${item.ConLai >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>Hiện tại: {money(item.ConLai)}</span>
                        ) : (
                          <span className={\`font-bold text-[13px] \${item.ConLai >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>Còn lại: {money(item.ConLai)}</span>
                        )}
                      </div>`;

let hasError = false;
if (!content.includes(t_overview12Months)) { console.log("t_overview12Months missing"); hasError = true; }
if (!content.includes(t_mobileStatsRow)) { console.log("t_mobileStatsRow missing"); hasError = true; }

if (hasError) process.exit(1);

content = content.replace(t_overview12Months, r_overview12Months);
content = content.replace(t_mobileStatsRow, r_mobileStatsRow);

fs.writeFileSync(file, content);
console.log("Patched MobileStats table");
