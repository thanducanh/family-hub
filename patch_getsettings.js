const fs = require('fs');
let c = fs.readFileSync('src/app/api/finance-overview/route.ts', 'utf8');

c = c.replace(/opening_cash_balance::float as "openingCashBalance",/, 'opening_cash_balance::float as "openingCashBalance", opening_cash_amount::float as "openingCashAmount", opening_debit_amount::float as "openingDebitAmount", opening_wallet_amount::float as "openingWalletAmount",');
c = c.replace(/openingCashBalance: Number\(row\.openingCashBalance \|\| 0\),/, 'openingCashBalance: Number(row.openingCashBalance || 0), openingCashAmount: row.openingCashAmount, openingDebitAmount: row.openingDebitAmount, openingWalletAmount: row.openingWalletAmount,');

fs.writeFileSync('src/app/api/finance-overview/route.ts', c);
console.log('Patched getFinanceSettings');
