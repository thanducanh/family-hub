const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8');

const getSettingsRegex = /opening_investment_balance::float as "openingInvestmentBalance"[\s\S]*?openingInvestmentBalance: Number\(row\.openingInvestmentBalance \|\| 0\),\n\s*\};[\s\S]*?openingInvestmentBalance: 0 \};/m;
const getSettingsReplacement = `opening_investment_balance::float as "openingInvestmentBalance",
              opening_cash_amount::float as "openingCashAmount",
              opening_debit_amount::float as "openingDebitAmount",
              opening_wallet_amount::float as "openingWalletAmount"
       FROM finance_settings
       LIMIT 1\`
    );
    const row = result.rows[0] || {};
    return {
      trackingStartDate: row.trackingStartDate || "2024-01-01",
      trackingStartMonth: Number(row.trackingStartMonth || 1),
      trackingStartYear: Number(row.trackingStartYear || 2024),
      openingCashBalance: Number(row.openingCashBalance || 0),
      openingSavingsBalance: Number(row.openingSavingsBalance || 0),
      openingInvestmentBalance: Number(row.openingInvestmentBalance || 0),
      openingCashAmount: Number(row.openingCashAmount || 0),
      openingDebitAmount: Number(row.openingDebitAmount || 0),
      openingWalletAmount: Number(row.openingWalletAmount || 0),
    };
  } catch {
    return { trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashBalance: 0, openingSavingsBalance: 0, openingInvestmentBalance: 0, openingCashAmount: 0, openingDebitAmount: 0, openingWalletAmount: 0 };`;
content = content.replace(getSettingsRegex, getSettingsReplacement);

const currentCashRegex = /const currentCash = settings\.openingCashBalance\s*\+\s*Number\(row\.total_income \|\| 0\)/m;
const currentCashReplacement = `const totalOpeningCashFields = (settings.openingCashAmount || 0) + (settings.openingDebitAmount || 0) + (settings.openingWalletAmount || 0);
    const initialCash = (totalOpeningCashFields > 0 || settings.openingCashAmount !== undefined) && (settings.openingCashAmount > 0 || settings.openingDebitAmount > 0 || settings.openingWalletAmount > 0) ? totalOpeningCashFields : settings.openingCashBalance;

    const currentCash = initialCash
      + Number(row.total_income || 0)`;
content = content.replace(currentCashRegex, currentCashReplacement);

const cumulativeCashRegex = /let cumulativeCash = settings\.openingCashBalance\s*\+\s*Number\(beforeYear\.total_income \|\| 0\)/m;
const cumulativeCashReplacement = `let cumulativeCash = initialCash
      + Number(beforeYear.total_income || 0)`;
content = content.replace(cumulativeCashRegex, cumulativeCashReplacement);

const breakdownRegex = /openingCashBalance: settings\.openingCashBalance,/m;
const breakdownReplacement = `openingCashBalance: initialCash,
          openingCashAmount: settings.openingCashAmount,
          openingDebitAmount: settings.openingDebitAmount,
          openingWalletAmount: settings.openingWalletAmount,`;
content = content.replace(breakdownRegex, breakdownReplacement);

fs.writeFileSync(file, content);
console.log("Patched finance-overview/route.ts");
