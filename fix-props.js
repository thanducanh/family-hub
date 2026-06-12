const fs = require('fs');
const filePath = 'src/components/family-app.tsx';
let appCode = fs.readFileSync(filePath, 'utf8');

appCode = appCode.replace(
  '{tab === "investments" && <InvestmentSheet />}',
  '{tab === "investments" && <InvestmentSheet user={user} />}'
);

fs.writeFileSync(filePath, appCode, 'utf8');
console.log('Fixed props!');
