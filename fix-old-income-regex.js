const fs = require('fs');
const filePath = 'src/components/family-app.tsx';
let appCode = fs.readFileSync(filePath, 'utf8');

appCode = appCode.replace(
  /function OldIncomeManagement\(\) \{([\s\S]*?)const \[year, setYear\]/m,
  'function OldIncomeManagement() {\n  const { toast, confirm } = useUI();\n  const [year, setYear]'
);

fs.writeFileSync(filePath, appCode, 'utf8');
console.log('Fixed OldIncomeManagement with regex!');
