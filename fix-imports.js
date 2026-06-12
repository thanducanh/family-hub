const fs = require('fs');
const filePath = 'src/components/family-app.tsx';
let appCode = fs.readFileSync(filePath, 'utf8');

appCode = appCode.replace(
  'IncomeYearlySummaryRow } from "@/types";',
  'IncomeYearlySummaryRow, InvestmentTransaction } from "@/types";'
);

fs.writeFileSync(filePath, appCode, 'utf8');
console.log('Fixed imports!');
