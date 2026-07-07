const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1. Update the SQL query in getFinanceSettings to fetch opening amounts
const originalSettingsQuery = `opening_investment_balance::float as "openingInvestmentBalance"
       FROM finance_settings`;
const newSettingsQuery = `opening_investment_balance::float as "openingInvestmentBalance",
              opening_cash_amount::float as "openingCashAmount",
              opening_debit_amount::float as "openingDebitAmount",
              opening_wallet_amount::float as "openingWalletAmount"
       FROM finance_settings`;
if (content.includes(originalSettingsQuery)) {
  content = content.replace(originalSettingsQuery, newSettingsQuery);
}

// 2. Update the row mapping in getFinanceSettings
const originalSettingsRow = `openingSavingsBalance: Number(row.openingSavingsBalance || 0),
      openingInvestmentBalance: Number(row.openingInvestmentBalance || 0),`;
const newSettingsRow = `openingSavingsBalance: Number(row.openingSavingsBalance || 0),
      openingInvestmentBalance: Number(row.openingInvestmentBalance || 0),
      openingCashAmount: Number(row.openingCashAmount || 0),
      openingDebitAmount: Number(row.openingDebitAmount || 0),
      openingWalletAmount: Number(row.openingWalletAmount || 0),`;
if (content.includes(originalSettingsRow)) {
  content = content.replace(originalSettingsRow, newSettingsRow);
}

// 3. Update currentCash to use totalOpeningCash
const originalCurrentCash = `    const currentCash = settings.openingCashBalance
      + Number(row.total_income || 0)`;
const newCurrentCash = `    const currentCash = (settings as any).totalOpeningCash
      + Number(row.total_income || 0)`;
if (content.includes(originalCurrentCash)) {
  content = content.replace(originalCurrentCash, newCurrentCash);
}

// 4. Update cumulativeCash to use totalOpeningCash
const originalCumulativeCash = `    let cumulativeCash = settings.openingCashBalance
      + Number(beforeYear.total_income || 0)`;
const newCumulativeCash = `    let cumulativeCash = (settings as any).totalOpeningCash
      + Number(beforeYear.total_income || 0)`;
if (content.includes(originalCumulativeCash)) {
  content = content.replace(originalCumulativeCash, newCumulativeCash);
}

// 5. Query global pending credit and add it to response
const originalResponse = `    return NextResponse.json({
      ok: true,
      data: {
        monthlyData,
        currentCash,`;
const newResponse = `
    const globalPendingCreditQuery = await pool.query(\`SELECT SUM(amount) as total FROM card_pending_transactions WHERE status = 'pending'\`);
    const globalPendingCredit = Number(globalPendingCreditQuery.rows[0]?.total || 0);

    return NextResponse.json({
      ok: true,
      data: {
        monthlyData,
        currentCash,
        pendingCredit: globalPendingCredit,`;
if (content.includes(originalResponse)) {
  content = content.replace(originalResponse, newResponse);
}

fs.writeFileSync(file, content);
console.log("Patched route.ts");
