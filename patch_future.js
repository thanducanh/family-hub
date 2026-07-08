const fs = require('fs');
let c = fs.readFileSync('src/app/api/finance-overview/route.ts', 'utf8');

c = c.replace(/const inTrackingRange = year > settings\.trackingStartYear \|\| \(year === settings\.trackingStartYear && item\.month >= settings\.trackingStartMonth\);\s*if \(inTrackingRange\) cumulativeCash \+= monthlyCashFlow;\s*return \{ \.\.\.item, netInvestment, afterExpense, monthlyCashFlow, cumulativeCash \};/, `const inTrackingRange = year > settings.trackingStartYear || (year === settings.trackingStartYear && item.month >= settings.trackingStartMonth);
      if (inTrackingRange) cumulativeCash += monthlyCashFlow;
      const currentRealMonth = new Date().getMonth() + 1;
      const currentRealYear = new Date().getFullYear();
      const isFuture = year > currentRealYear || (year === currentRealYear && item.month > currentRealMonth);
      return { ...item, netInvestment, afterExpense, monthlyCashFlow, cumulativeCash: isFuture ? null : cumulativeCash };`);

fs.writeFileSync('src/app/api/finance-overview/route.ts', c);
console.log('Patched future months');
