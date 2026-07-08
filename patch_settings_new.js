const fs = require('fs');

let c = fs.readFileSync('src/app/api/finance-settings/route.ts', 'utf8');

const ensureTableOld = `  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_savings_balance NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_investment_balance NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()");`;
const ensureTableNew = `  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_savings_balance NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_investment_balance NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_cash_amount NUMERIC");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_debit_amount NUMERIC");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_wallet_amount NUMERIC");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()");`;
c = c.replace(ensureTableOld, ensureTableNew);

const selectOld = `opening_cash_balance::float as "openingCashBalance",
             opening_savings_balance::float as "openingSavingsBalance",
             opening_investment_balance::float as "openingInvestmentBalance"
      FROM finance_settings`;
const selectNew = `opening_cash_balance::float as "openingCashBalance",
             opening_savings_balance::float as "openingSavingsBalance",
             opening_investment_balance::float as "openingInvestmentBalance",
             opening_cash_amount::float as "openingCashAmount",
             opening_debit_amount::float as "openingDebitAmount",
             opening_wallet_amount::float as "openingWalletAmount"
      FROM finance_settings`;
c = c.replace(selectOld, selectNew);

const putOld = `const openingCashBalance = Number(body.openingCashBalance ?? body.opening_cash_balance ?? 0) || 0;
    const openingSavingsBalance = Number(body.openingSavingsBalance ?? body.opening_savings_balance ?? 0) || 0;
    const openingInvestmentBalance = Number(body.openingInvestmentBalance ?? body.opening_investment_balance ?? 0) || 0;

    const check = await pool.query("SELECT id FROM finance_settings LIMIT 1");
    if (check.rows.length > 0) {
      await pool.query(
        \`UPDATE finance_settings
         SET tracking_start_date = $1,
             tracking_start_month = $2,
             tracking_start_year = $3,
             opening_cash_balance = $4,
             opening_savings_balance = $5,
             opening_investment_balance = $6,
             updated_at = now()\`,
        [start.date, start.month, start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance]
      );
    } else {
      await pool.query(
        \`INSERT INTO finance_settings (tracking_start_date, tracking_start_month, tracking_start_year, opening_cash_balance, opening_savings_balance, opening_investment_balance)
         VALUES ($1, $2, $3, $4, $5, $6)\`,
        [start.date, start.month, start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance]
      );
    }

    return NextResponse.json({ ok: true, data: { trackingStartDate: start.date, trackingStartMonth: start.month, trackingStartYear: start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance } });`;

const putNew = `const openingCashBalance = Number(body.openingCashBalance ?? body.opening_cash_balance ?? 0) || 0;
    const openingSavingsBalance = Number(body.openingSavingsBalance ?? body.opening_savings_balance ?? 0) || 0;
    const openingInvestmentBalance = Number(body.openingInvestmentBalance ?? body.opening_investment_balance ?? 0) || 0;
    
    let openingCashAmount = null;
    let openingDebitAmount = null;
    let openingWalletAmount = null;
    if (body.openingCashAmount !== undefined && body.openingCashAmount !== null) openingCashAmount = Number(body.openingCashAmount);
    if (body.openingDebitAmount !== undefined && body.openingDebitAmount !== null) openingDebitAmount = Number(body.openingDebitAmount);
    if (body.openingWalletAmount !== undefined && body.openingWalletAmount !== null) openingWalletAmount = Number(body.openingWalletAmount);

    const check = await pool.query("SELECT id FROM finance_settings LIMIT 1");
    if (check.rows.length > 0) {
      await pool.query(
        \`UPDATE finance_settings
         SET tracking_start_date = $1,
             tracking_start_month = $2,
             tracking_start_year = $3,
             opening_cash_balance = $4,
             opening_savings_balance = $5,
             opening_investment_balance = $6,
             opening_cash_amount = $7,
             opening_debit_amount = $8,
             opening_wallet_amount = $9,
             updated_at = now()\`,
        [start.date, start.month, start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance, openingCashAmount, openingDebitAmount, openingWalletAmount]
      );
    } else {
      await pool.query(
        \`INSERT INTO finance_settings (tracking_start_date, tracking_start_month, tracking_start_year, opening_cash_balance, opening_savings_balance, opening_investment_balance, opening_cash_amount, opening_debit_amount, opening_wallet_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)\`,
        [start.date, start.month, start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance, openingCashAmount, openingDebitAmount, openingWalletAmount]
      );
    }

    return NextResponse.json({ ok: true, data: { trackingStartDate: start.date, trackingStartMonth: start.month, trackingStartYear: start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance, openingCashAmount, openingDebitAmount, openingWalletAmount } });`;

c = c.replace(putOld, putNew);
fs.writeFileSync('src/app/api/finance-settings/route.ts', c);
console.log('Patched finance-settings/route.ts successfully.');
