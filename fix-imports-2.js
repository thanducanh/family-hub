const fs = require('fs');
const filePath = 'src/components/family-app.tsx';
let appCode = fs.readFileSync(filePath, 'utf8');

appCode = appCode.replace(
  'InvestmentTransaction } from "@/types";',
  'InvestmentTransaction, InvestmentAction } from "@/types";'
);

fs.writeFileSync(filePath, appCode, 'utf8');
console.log('Fixed imports again!');
