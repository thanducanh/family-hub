const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_monthlyData = `    const monthlyData = Object.values(dataMap).sort((a, b) => a.month - b.month).map(item => {
      const afterExpense = item.income - item.expense;
      const netInvestment = item.investmentBuy - item.investmentSell;
      const monthlyCashFlow = afterExpense - item.savingsInExpense - item.savingsRecords - item.investmentBuy + item.investmentSell + item.adjustment;
      const inTrackingRange = year > settings.trackingStartYear || (year === settings.trackingStartYear && item.month >= settings.trackingStartMonth);
      if (inTrackingRange) cumulativeCash += monthlyCashFlow;
      return { ...item, netInvestment, afterExpense, monthlyCashFlow, cumulativeCash };
    });`;

const r_monthlyData = `    const monthlyData = Object.values(dataMap).sort((a, b) => a.month - b.month).map(item => {
      const afterExpense = item.income - item.expense;
      const netInvestment = item.investmentBuy - item.investmentSell;
      const monthlyCashFlow = afterExpense - item.savingsInExpense - item.savingsRecords - item.investmentBuy + item.investmentSell + item.adjustment;
      
      const now = new Date();
      // Vietnam timezone is UTC+7, simple approximation:
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const isFuture = year > currentYear || (year === currentYear && item.month > currentMonth);
      const isCurrent = year === currentYear && item.month === currentMonth;

      const inTrackingRange = year > settings.trackingStartYear || (year === settings.trackingStartYear && item.month >= settings.trackingStartMonth);
      
      if (inTrackingRange && !isFuture) {
        cumulativeCash += monthlyCashFlow;
      }
      
      return { 
        ...item, 
        netInvestment, 
        afterExpense, 
        monthlyCashFlow, 
        cumulativeCash: isFuture ? null : cumulativeCash,
        isFuture,
        isCurrent
      };
    });`;

let hasError = false;
if (!content.includes(t_monthlyData)) { console.log("t_monthlyData missing"); hasError = true; }

if (hasError) process.exit(1);

content = content.replace(t_monthlyData, r_monthlyData);

fs.writeFileSync(file, content);
console.log("Patched finance-overview monthlyData");
