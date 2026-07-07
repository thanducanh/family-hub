const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_errorLine = `    let totalOpeningCash = settings.openingCashAmount + settings.openingDebitAmount + settings.openingWalletAmount;
    if (totalOpeningCash === 0 && settings.openingCashBalance > 0) totalOpeningCash = settings.openingCashBalance;`;

const r_errorLine = `    let totalOpeningCash = Number(settings.openingCashAmount || 0) + Number(settings.openingDebitAmount || 0) + Number(settings.openingWalletAmount || 0);
    if (totalOpeningCash === 0 && Number(settings.openingCashBalance || 0) > 0) totalOpeningCash = Number(settings.openingCashBalance || 0);`;

content = content.replace(t_errorLine, r_errorLine);

fs.writeFileSync(file, content);
console.log("Patched API types");
