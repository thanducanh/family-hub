const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8');

const originalGetSettings = `async function getFinanceSettings() {
  try {
    await ensureFinanceSettingsTable();
    const result = await pool.query(
      \`SELECT to_char(COALESCE(tracking_start_date, make_date(tracking_start_year, tracking_start_month, 1)), 'YYYY-MM-DD') as "trackingStartDate",
              COALESCE(tracking_start_month, EXTRACT(MONTH FROM tracking_start_date)::integer, 1) as "trackingStartMonth",
              COALESCE(tracking_start_year, EXTRACT(YEAR FROM tracking_start_date)::integer, 2024) as "trackingStartYear",
              opening_cash_balance::float as "openingCashBalance",
              opening_savings_balance::float as "openingSavingsBalance",
              opening_investment_balance::float as "openingInvestmentBalance"
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
    };
  } catch {
    return { trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashBalance: 0, openingSavingsBalance: 0, openingInvestmentBalance: 0 };
  }
}`;

const newGetSettings = `async function getFinanceSettings() {
  try {
    await ensureFinanceSettingsTable();
    const result = await pool.query(
      \`SELECT to_char(COALESCE(tracking_start_date, make_date(tracking_start_year, tracking_start_month, 1)), 'YYYY-MM-DD') as "trackingStartDate",
              COALESCE(tracking_start_month, EXTRACT(MONTH FROM tracking_start_date)::integer, 1) as "trackingStartMonth",
              COALESCE(tracking_start_year, EXTRACT(YEAR FROM tracking_start_date)::integer, 2024) as "trackingStartYear",
              opening_cash_balance::float as "openingCashBalance",
              opening_savings_balance::float as "openingSavingsBalance",
              opening_investment_balance::float as "openingInvestmentBalance",
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
  }
}`;

content = content.replace(originalGetSettings, newGetSettings);

const originalCashCalc = `    const currentCash = settings.openingCashBalance
      + Number(row.total_income || 0)`;
const newCashCalc = `    const totalOpeningCashFields = (settings.openingCashAmount || 0) + (settings.openingDebitAmount || 0) + (settings.openingWalletAmount || 0);
    const initialCash = (totalOpeningCashFields > 0 || settings.openingCashAmount !== undefined) && (settings.openingCashAmount > 0 || settings.openingDebitAmount > 0 || settings.openingWalletAmount > 0) ? totalOpeningCashFields : settings.openingCashBalance;

    const currentCash = initialCash
      + Number(row.total_income || 0)`;
content = content.replace(originalCashCalc, newCashCalc);

const originalCumCash = `    let cumulativeCash = settings.openingCashBalance
      + Number(beforeYear.total_income || 0)`;
const newCumCash = `    let cumulativeCash = initialCash
      + Number(beforeYear.total_income || 0)`;
content = content.replace(originalCumCash, newCumCash);

const originalBreakdown = `openingCashBalance: settings.openingCashBalance,`;
const newBreakdown = `openingCashBalance: initialCash,
          openingCashAmount: settings.openingCashAmount,
          openingDebitAmount: settings.openingDebitAmount,
          openingWalletAmount: settings.openingWalletAmount,`;
content = content.replace(originalBreakdown, newBreakdown);


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

const originalReturn = `    return NextResponse.json({
      ok: true,
      data: {
        monthlyData,
        currentCash,`;
const newReturn = queryForPending + `    return NextResponse.json({
      ok: true,
      data: {
        monthlyData,
        currentCash,
        availableCash,
        pendingCreditTotal,
        afterCreditPayment,`;
content = content.replace(originalReturn, newReturn);

fs.writeFileSync(file, content);
console.log("Patched finance-overview/route.ts safely");
