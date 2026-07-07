const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
const lines = fs.readFileSync(file, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  // Fix getFinanceSettings return
  if (lines[i].includes('opening_investment_balance::float as "openingInvestmentBalance"')) {
    lines[i] = `              opening_investment_balance::float as "openingInvestmentBalance",
              opening_cash_amount::float as "openingCashAmount",
              opening_debit_amount::float as "openingDebitAmount",
              opening_wallet_amount::float as "openingWalletAmount"`;
  }
  
  if (lines[i].includes('openingInvestmentBalance: Number(row.openingInvestmentBalance || 0),')) {
    lines[i] = `      openingInvestmentBalance: Number(row.openingInvestmentBalance || 0),
      openingCashAmount: Number(row.openingCashAmount || 0),
      openingDebitAmount: Number(row.openingDebitAmount || 0),
      openingWalletAmount: Number(row.openingWalletAmount || 0),`;
  }

  if (lines[i].includes('openingInvestmentBalance: 0 };') && lines[i-1] && lines[i-1].includes('catch')) {
    lines[i] = `    return { trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashBalance: 0, openingSavingsBalance: 0, openingInvestmentBalance: 0, openingCashAmount: 0, openingDebitAmount: 0, openingWalletAmount: 0 };`;
  }

  // Fix currentCash
  if (lines[i].includes('const currentCash = settings.openingCashBalance')) {
    lines[i] = `    const totalOpeningCashFields = (settings.openingCashAmount || 0) + (settings.openingDebitAmount || 0) + (settings.openingWalletAmount || 0);
    const initialCash = (totalOpeningCashFields > 0 || settings.openingCashAmount !== undefined) && (settings.openingCashAmount > 0 || settings.openingDebitAmount > 0 || settings.openingWalletAmount > 0) ? totalOpeningCashFields : settings.openingCashBalance;

    const currentCash = initialCash`;
  }

  // Fix cumulativeCash
  if (lines[i].includes('let cumulativeCash = settings.openingCashBalance')) {
    lines[i] = `    let cumulativeCash = initialCash`;
  }

  // Fix breakdown
  if (lines[i].includes('openingCashBalance: settings.openingCashBalance,')) {
    lines[i] = `          openingCashBalance: initialCash,
          openingCashAmount: settings.openingCashAmount,
          openingDebitAmount: settings.openingDebitAmount,
          openingWalletAmount: settings.openingWalletAmount,`;
  }
}

let content = lines.join('\n');

// Add pending credit logic if not exists
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
if (resRegex.test(content) && !content.includes('pendingCreditTotal')) {
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
console.log("Patched safely with array loop");
