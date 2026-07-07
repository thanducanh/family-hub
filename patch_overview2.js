const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8');

const getSettingsRegex = /opening_investment_balance::float as "openingInvestmentBalance"[\s\S]*?openingInvestmentBalance: Number\(row\.openingInvestmentBalance \|\| 0\),\n\s*\};\n\s*\} catch \{\n\s*return \{ trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashBalance: 0, openingSavingsBalance: 0, openingInvestmentBalance: 0 \};\n\s*\}/m;
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
    return { trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashBalance: 0, openingSavingsBalance: 0, openingInvestmentBalance: 0, openingCashAmount: 0, openingDebitAmount: 0, openingWalletAmount: 0 };
  }`;
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

// Fix pendingCredit logic added before via string matching just in case it was wiped by git restore
const queryForPending = `
    const paramsPending = ['pending'];
    let wherePending = "status = $1";
    if (filter.params[0]) {
      paramsPending.push(filter.params[0]);
      wherePending += " AND member_id = $2";
    }
    const globalPendingCreditQuery = await pool.query(\`SELECT SUM(amount) as total FROM card_pending_transactions WHERE \${wherePending}\`, paramsPending);
    const pendingCreditTotal = Number(globalPendingCreditQuery.rows[0]?.total || 0);
    const availableCash = currentCash;
    const afterCreditPayment = availableCash - pendingCreditTotal;
`;

const resRegex = /return NextResponse\.json\(\{\s*ok: true,\s*data: \{\s*monthlyData,\s*currentCash,/;
if (resRegex.test(content)) {
  content = content.replace(resRegex, queryForPending + `
    return NextResponse.json({
      ok: true,
      data: {
        monthlyData,
        currentCash,
        availableCash,
        pendingCreditTotal,
        afterCreditPayment,`);
}

fs.writeFileSync(file, content);
console.log("Patched finance-overview/route.ts");
