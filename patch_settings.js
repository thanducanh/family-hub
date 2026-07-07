const fs = require('fs');
const file = 'src/app/api/finance-settings/route.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add schema additions
const schemaRegex = /await pool\.query\("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now\(\)"\);/;
const schemaReplacement = `await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_cash_amount NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_debit_amount NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_wallet_amount NUMERIC DEFAULT 0");`;
content = content.replace(schemaRegex, schemaReplacement);

// 2. Add SELECT fields
const selectRegex = /opening_investment_balance::float as "openingInvestmentBalance"/;
const selectReplacement = `opening_investment_balance::float as "openingInvestmentBalance",
             opening_cash_amount::float as "openingCashAmount",
             opening_debit_amount::float as "openingDebitAmount",
             opening_wallet_amount::float as "openingWalletAmount"`;
content = content.replace(selectRegex, selectReplacement);

// 3. GET fallback fields
const fallbackRegex = /openingInvestmentBalance: 0 \} \}\);/g;
const fallbackReplacement = `openingInvestmentBalance: 0, openingCashAmount: 0, openingDebitAmount: 0, openingWalletAmount: 0 } });`;
content = content.replace(fallbackRegex, fallbackReplacement);

// 4. PUT body read
const putReadRegex = /const openingInvestmentBalance = Number\(body\.openingInvestmentBalance \?\? body\.opening_investment_balance \?\? 0\) \|\| 0;/;
const putReadReplacement = `const openingInvestmentBalance = Number(body.openingInvestmentBalance ?? body.opening_investment_balance ?? 0) || 0;
    const openingCashAmount = Number(body.openingCashAmount ?? body.opening_cash_amount ?? 0) || 0;
    const openingDebitAmount = Number(body.openingDebitAmount ?? body.opening_debit_amount ?? 0) || 0;
    const openingWalletAmount = Number(body.openingWalletAmount ?? body.opening_wallet_amount ?? 0) || 0;`;
content = content.replace(putReadRegex, putReadReplacement);

// 5. UPDATE
const updateRegex = /opening_investment_balance = \$6,/;
const updateReplacement = `opening_investment_balance = $6,
             opening_cash_amount = $7,
             opening_debit_amount = $8,
             opening_wallet_amount = $9,`;
content = content.replace(updateRegex, updateReplacement);

// 6. UPDATE values
const updateValuesRegex = /\[start\.date, start\.month, start\.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance\]/;
const updateValuesReplacement = `[start.date, start.month, start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance, openingCashAmount, openingDebitAmount, openingWalletAmount]`;
content = content.replace(updateValuesRegex, updateValuesReplacement);

// 7. INSERT
const insertRegex = /opening_cash_balance, opening_savings_balance, opening_investment_balance\)/;
const insertReplacement = `opening_cash_balance, opening_savings_balance, opening_investment_balance, opening_cash_amount, opening_debit_amount, opening_wallet_amount)`;
content = content.replace(insertRegex, insertReplacement);

// 8. PUT response
const putResponseRegex = /openingInvestmentBalance \} \}\);/g;
const putResponseReplacement = `openingInvestmentBalance, openingCashAmount, openingDebitAmount, openingWalletAmount } });`;
content = content.replace(putResponseRegex, putResponseReplacement);

fs.writeFileSync(file, content);
console.log("Patched finance-settings/route.ts");
