const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// Patch in MobileTransactionList
content = content.replace(
  `const monthlyInfo = calculateMonthlyUsableBalanceInfo(month, year, toArray(appData?.transactions), toArray(incomes), "all");`,
  `const monthlyInfo = calculateMonthlyUsableBalanceInfo(month, year, toArray(appData?.transactions), toArray(incomes), "all", overviewData?.settings);`
);

// We need to patch the Desktop view. Let's find how calculateMonthlyUsableBalanceInfo is called there.
// I'll run a regex to find all usages and replace them if they don't have settings.
// But we need the settings object available. 
// In FinanceDashboard / ExpenseOverview, maybe there is `overview?.settings`.
const matches = [...content.matchAll(/calculateMonthlyUsableBalanceInfo\((.*?)\)/g)];
for (const match of matches) {
  if (match[0].includes("overviewData?.settings") || match[0].includes("settings")) continue;
  console.log("Found unpatched:", match[0]);
}

fs.writeFileSync(file, content);
console.log("MobileTransactionList patched");
