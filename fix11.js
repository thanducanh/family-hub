const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// Patch calculateMonthlyUsableBalance
content = content.replace(
  `const currentRemaining = calculateMonthlyUsableBalance(selectedMonth, selectedYear, data.transactions || [], incomesRecords, "all");`,
  `const currentRemaining = calculateMonthlyUsableBalance(selectedMonth, selectedYear, data.transactions || [], incomesRecords, "all", overviewData?.settings);`
);

content = content.replace(
  `ConLai: calculateMonthlyUsableBalance(m, selectedYear, data.transactions || [], incomesRecords, "all")`,
  `ConLai: calculateMonthlyUsableBalance(m, selectedYear, data.transactions || [], incomesRecords, "all", overviewData?.settings)`
);

// Look for other calls
const matches = [...content.matchAll(/calculateMonthlyUsableBalance(Info)?\((.*?)\)/g)];
for (const match of matches) {
  if (match[0].includes("settings")) continue;
  if (match[0].includes("function calculateMonthlyUsableBalance")) continue;
  console.log("Unpatched:", match[0]);
}

fs.writeFileSync(file, content);
console.log("Patched calculateMonthlyUsableBalance");
