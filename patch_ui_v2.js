const fs = require('fs');

let c = fs.readFileSync('src/components/family-app.tsx', 'utf8');

const regex = /const availableThisMonth = calculateMonthlyUsableBalance\([^)]+\);/;
const replacement = `const monthlyDataArray = overviewDataCache[year]?.monthlyData || [];
  const currentMonthData = monthlyDataArray.find((m: any) => m.month === month);
  const availableThisMonth = currentMonthData ? Number(currentMonthData.cumulativeCash || 0) : 0;
  const pendingCredit = overviewDataCache[year]?.pendingCreditTotal || 0;
  const afterCreditPayment = availableThisMonth - pendingCredit;`;

c = c.replace(regex, replacement);

fs.writeFileSync('src/components/family-app.tsx', c);
console.log('Patched availableThisMonth and pendingCredit');
