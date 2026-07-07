const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// cashBreakdown
content = content.replace(
  /openingCashBalance:\s+settings\.openingCashBalance,/,
  'openingCashBalance: settings.totalOpeningCash,'
);

fs.writeFileSync(file, content);
console.log("Patched cashBreakdown");
