const fs = require('fs');
const file = 'src/app/api/finance-overview/route.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1. SELECT query in getFinanceSettings
const t_query = `                opening_cash_balance::float as "openingCashBalance",
                opening_savings_balance::float as "openingSavingsBalance",
                opening_investment_balance::float as "openingInvestmentBalance"`;
const r_query = `                opening_cash_balance::float as "openingCashBalance",
                opening_cash_amount::float as "openingCashAmount",
                opening_debit_amount::float as "openingDebitAmount",
                opening_wallet_amount::float as "openingWalletAmount",
                opening_savings_balance::float as "openingSavingsBalance",
                opening_investment_balance::float as "openingInvestmentBalance"`;
content = content.replace(t_query, r_query);

// 2. Mapping row to settings
const t_row = `        openingCashBalance: Number(row.openingCashBalance || 0),
        openingSavingsBalance: Number(row.openingSavingsBalance || 0),`;
const r_row = `        openingCashAmount: Number(row.openingCashAmount || 0),
        openingDebitAmount: Number(row.openingDebitAmount || 0),
        openingWalletAmount: Number(row.openingWalletAmount || 0),
        openingCashBalance: Number(row.openingCashBalance || 0),
        openingSavingsBalance: Number(row.openingSavingsBalance || 0),`;
content = content.replace(t_row, r_row);

// 3. getFinanceSettings catch block
const t_catch = `    return { trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashBalance: 0, openingSavingsBalance: 0, openingInvestmentBalance: 0 };`;
const r_catch = `    return { trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashAmount: 0, openingDebitAmount: 0, openingWalletAmount: 0, openingCashBalance: 0, openingSavingsBalance: 0, openingInvestmentBalance: 0 };`;
content = content.replace(t_catch, r_catch);

// 4. In GET, calculate totalOpeningCash
const t_getStart = `    const settings = await getFinanceSettings();`;
const r_getStart = `    const settings = await getFinanceSettings();
    let totalOpeningCash = settings.openingCashAmount + settings.openingDebitAmount + settings.openingWalletAmount;
    if (totalOpeningCash === 0 && settings.openingCashBalance > 0) totalOpeningCash = settings.openingCashBalance;
    settings.totalOpeningCash = totalOpeningCash;`;
content = content.replace(t_getStart, r_getStart);

// 5. Replace settings.openingCashBalance in currentCash with totalOpeningCash
const t_currentCash = `    const currentCash = settings.openingCashBalance
        + Number(row.total_income || 0)
        - Number(row.total_expense || 0)
        - savingsRecordsTotal
        - savingsFromExpensesTotal
        - investmentBuyTotal
        + investmentSellTotal
        + adjustmentTotal;`;
const r_currentCash = `    // Get total adjustments from trackingStartDate
    const adjustmentRes = await pool.query(
      \`SELECT SUM(amount) as total_adjustment FROM finance_adjustments WHERE date >= $1 \${filter2.where.replace(/AND date >= \\$\\d+/, '')}\`,
      [settings.trackingStartDate, ...filter2.params]
    );
    const totalAdjustmentSinceStart = Number(adjustmentRes.rows[0]?.total_adjustment || 0);

    const currentCash = settings.totalOpeningCash
        + Number(row.total_income || 0)
        - Number(row.total_expense || 0)
        - savingsRecordsTotal
        - savingsFromExpensesTotal
        - investmentBuyTotal
        + investmentSellTotal
        + totalAdjustmentSinceStart
        - totalPaidCreditCards(row); // Need to subtract credit card payments if we tracked them, but maybe it's in expense?`;

// Wait, the user said: "- Thanh toán thẻ tín dụng đã thực hiện". But aren't credit card payments just expense transactions?
// Ah! Wait, if it's an expense transaction with paymentMethod = 'credit', it's NOT a real expense. Oh no, the user said "Chi thật".
// "Chi thật" = total_expense excluding credit card pending?
// Let's look at how "total_expense" is currently calculated in `finance-overview`!
fs.writeFileSync(file, content);
console.log("Patched some API settings");
