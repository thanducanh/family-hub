const fs = require('fs');

let c = fs.readFileSync('src/components/family-app.tsx', 'utf8');

c = c.replace(/const availableThisMonth = currentMonthData \? Number\(currentMonthData\.cumulativeCash \|\| 0\) : 0;/, `const availableThisMonth = currentMonthData ? Number(currentMonthData.cumulativeCash || 0) : 0;
  const pendingCredit = overviewDataCache[year]?.pendingCreditTotal || 0;
  const afterCreditPayment = availableThisMonth - pendingCredit;`);

fs.writeFileSync('src/components/family-app.tsx', c);
console.log('Patched UI pendingCredit variables');
