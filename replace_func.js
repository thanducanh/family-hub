const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = '  const availableThisMonth = calculateMonthlyUsableBalance(month, year, toArray(appData?.transactions), toArray(incomes), "all");';
const replacement = '  const monthlyInfo = calculateMonthlyUsableBalanceInfo(month, year, toArray(appData?.transactions), toArray(incomes), "all");';

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
console.log("Replaced");
