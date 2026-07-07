const fs = require('fs');
const file = 'src/app/api/finance-settings/route.ts';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1. Add new columns in ensureFinanceSettingsTable
const t_ensure = `  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_cash_balance NUMERIC DEFAULT 0");`;
const r_ensure = `  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_cash_balance NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_cash_amount NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_debit_amount NUMERIC DEFAULT 0");
  await pool.query("ALTER TABLE finance_settings ADD COLUMN IF NOT EXISTS opening_wallet_amount NUMERIC DEFAULT 0");`;
content = content.replace(t_ensure, r_ensure);

// 2. Select query in GET
const t_select = `             opening_cash_balance::float as "openingCashBalance",
             opening_savings_balance::float as "openingSavingsBalance",
             opening_investment_balance::float as "openingInvestmentBalance"
      FROM finance_settings`;
const r_select = `             opening_cash_balance::float as "openingCashBalance",
             opening_cash_amount::float as "openingCashAmount",
             opening_debit_amount::float as "openingDebitAmount",
             opening_wallet_amount::float as "openingWalletAmount",
             opening_savings_balance::float as "openingSavingsBalance",
             opening_investment_balance::float as "openingInvestmentBalance"
      FROM finance_settings`;
content = content.replace(t_select, r_select);

// 3. Fallback in GET if 0
const t_fallback = `      return NextResponse.json({ ok: true, data: { trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashBalance: 0, openingSavingsBalance: 0, openingInvestmentBalance: 0 } });
    }
    return NextResponse.json({ ok: true, data: result.rows[0] });`;
const r_fallback = `      return NextResponse.json({ ok: true, data: { trackingStartDate: "2024-01-01", trackingStartMonth: 1, trackingStartYear: 2024, openingCashBalance: 0, openingCashAmount: 0, openingDebitAmount: 0, openingWalletAmount: 0, openingSavingsBalance: 0, openingInvestmentBalance: 0 } });
    }
    const data = result.rows[0];
    if ((data.openingCashAmount === 0 || data.openingCashAmount === null) && 
        (data.openingDebitAmount === 0 || data.openingDebitAmount === null) && 
        (data.openingWalletAmount === 0 || data.openingWalletAmount === null) && 
        data.openingCashBalance > 0) {
      data.openingCashAmount = data.openingCashBalance;
    }
    return NextResponse.json({ ok: true, data });`;
content = content.replace(t_fallback, r_fallback);

// 4. PUT assignments
const t_put = `    const openingCashBalance = Number(body.openingCashBalance ?? body.opening_cash_balance ?? 0) || 0;
    const openingSavingsBalance = Number(body.openingSavingsBalance ?? body.opening_savings_balance ?? 0) || 0;`;
const r_put = `    const openingCashBalance = Number(body.openingCashBalance ?? body.opening_cash_balance ?? 0) || 0;
    const openingCashAmount = Number(body.openingCashAmount ?? body.opening_cash_amount ?? 0) || 0;
    const openingDebitAmount = Number(body.openingDebitAmount ?? body.opening_debit_amount ?? 0) || 0;
    const openingWalletAmount = Number(body.openingWalletAmount ?? body.opening_wallet_amount ?? 0) || 0;
    const openingSavingsBalance = Number(body.openingSavingsBalance ?? body.opening_savings_balance ?? 0) || 0;`;
content = content.replace(t_put, r_put);

// 5. UPDATE
const t_update = `         SET tracking_start_date = $1,
             tracking_start_month = $2,
             tracking_start_year = $3,
             opening_cash_balance = $4,
             opening_savings_balance = $5,
             opening_investment_balance = $6,
             updated_at = now()\`,
        [start.date, start.month, start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance]`;
const r_update = `         SET tracking_start_date = $1,
             tracking_start_month = $2,
             tracking_start_year = $3,
             opening_cash_balance = $4,
             opening_savings_balance = $5,
             opening_investment_balance = $6,
             opening_cash_amount = $7,
             opening_debit_amount = $8,
             opening_wallet_amount = $9,
             updated_at = now()\`,
        [start.date, start.month, start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance, openingCashAmount, openingDebitAmount, openingWalletAmount]`;
content = content.replace(t_update, r_update);

// 6. INSERT
const t_insert = `        \`INSERT INTO finance_settings (tracking_start_date, tracking_start_month, tracking_start_year, opening_cash_balance, opening_savings_balance, opening_investment_balance)
         VALUES ($1, $2, $3, $4, $5, $6)\`,
        [start.date, start.month, start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance]`;
const r_insert = `        \`INSERT INTO finance_settings (tracking_start_date, tracking_start_month, tracking_start_year, opening_cash_balance, opening_savings_balance, opening_investment_balance, opening_cash_amount, opening_debit_amount, opening_wallet_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)\`,
        [start.date, start.month, start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance, openingCashAmount, openingDebitAmount, openingWalletAmount]`;
content = content.replace(t_insert, r_insert);

// 7. RETURN PUT
const t_return = `    return NextResponse.json({ ok: true, data: { trackingStartDate: start.date, trackingStartMonth: start.month, trackingStartYear: start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance } });`;
const r_return = `    return NextResponse.json({ ok: true, data: { trackingStartDate: start.date, trackingStartMonth: start.month, trackingStartYear: start.year, openingCashBalance, openingSavingsBalance, openingInvestmentBalance, openingCashAmount, openingDebitAmount, openingWalletAmount } });`;
content = content.replace(t_return, r_return);


fs.writeFileSync(file, content);
console.log("Patched finance-settings/route.ts");
