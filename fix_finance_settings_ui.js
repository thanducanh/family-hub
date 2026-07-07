const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1. Settings state in FinanceDashboard (around line 9350)
const t_setSettingsState = `  const [settings, setSettings] = useState({ trackingStartMonth: String(now.getMonth() + 1), trackingStartYear: String(now.getFullYear()), openingCashBalance: "0", openingSavingsBalance: "0", openingInvestmentBalance: "0" });`;
const r_setSettingsState = `  const [settings, setSettings] = useState({ trackingStartMonth: String(now.getMonth() + 1), trackingStartYear: String(now.getFullYear()), openingCashBalance: "0", openingCashAmount: "0", openingDebitAmount: "0", openingWalletAmount: "0", openingSavingsBalance: "0", openingInvestmentBalance: "0" });`;
content = content.replace(t_setSettingsState, r_setSettingsState);

// 2. Fetch settings
const t_setSettings = `      setSettings({
        trackingStartMonth: String(data.trackingStartMonth || now.getMonth() + 1),
        trackingStartYear: String(data.trackingStartYear || now.getFullYear()),
        openingCashBalance: String(data.openingCashBalance ?? 0),
        openingSavingsBalance: String(data.openingSavingsBalance ?? 0),
        openingInvestmentBalance: String(data.openingInvestmentBalance ?? 0),
      });`;
const r_setSettings = `      setSettings({
        trackingStartMonth: String(data.trackingStartMonth || now.getMonth() + 1),
        trackingStartYear: String(data.trackingStartYear || now.getFullYear()),
        openingCashBalance: String(data.openingCashBalance ?? 0),
        openingCashAmount: String(data.openingCashAmount ?? 0),
        openingDebitAmount: String(data.openingDebitAmount ?? 0),
        openingWalletAmount: String(data.openingWalletAmount ?? 0),
        openingSavingsBalance: String(data.openingSavingsBalance ?? 0),
        openingInvestmentBalance: String(data.openingInvestmentBalance ?? 0),
      });`;
content = content.replace(t_setSettings, r_setSettings);

// 3. Save settings
const t_saveSettings = `      const payload = {
        trackingStartMonth: Number(settings.trackingStartMonth) || now.getMonth() + 1,
        trackingStartYear: Number(settings.trackingStartYear) || now.getFullYear(),
        openingCashBalance: parseVndInput(settings.openingCashBalance),
        openingSavingsBalance: parseVndInput(settings.openingSavingsBalance),
        openingInvestmentBalance: parseVndInput(settings.openingInvestmentBalance),
      };`;
const r_saveSettings = `      const payload = {
        trackingStartMonth: Number(settings.trackingStartMonth) || now.getMonth() + 1,
        trackingStartYear: Number(settings.trackingStartYear) || now.getFullYear(),
        openingCashBalance: parseVndInput(settings.openingCashBalance),
        openingCashAmount: parseVndInput(settings.openingCashAmount),
        openingDebitAmount: parseVndInput(settings.openingDebitAmount),
        openingWalletAmount: parseVndInput(settings.openingWalletAmount),
        openingSavingsBalance: parseVndInput(settings.openingSavingsBalance),
        openingInvestmentBalance: parseVndInput(settings.openingInvestmentBalance),
      };`;
content = content.replace(t_saveSettings, r_saveSettings);

// 4. Set state after save
const t_setAfterSave = `      setSettings({ trackingStartMonth: String(payload.trackingStartMonth), trackingStartYear: String(payload.trackingStartYear), openingCashBalance: String(payload.openingCashBalance), openingSavingsBalance: String(payload.openingSavingsBalance), openingInvestmentBalance: String(payload.openingInvestmentBalance) });`;
const r_setAfterSave = `      setSettings({ trackingStartMonth: String(payload.trackingStartMonth), trackingStartYear: String(payload.trackingStartYear), openingCashBalance: String(payload.openingCashBalance), openingCashAmount: String(payload.openingCashAmount), openingDebitAmount: String(payload.openingDebitAmount), openingWalletAmount: String(payload.openingWalletAmount), openingSavingsBalance: String(payload.openingSavingsBalance), openingInvestmentBalance: String(payload.openingInvestmentBalance) });`;
content = content.replace(t_setAfterSave, r_setAfterSave);

// 5. FinanceDashboard UI for openingCashBalance
const t_ui = `          <label className="block"><span className={labelClass}>Tiền hiện tại ban đầu</span><input inputMode="numeric" className={mobileInputClass + " text-right"} value={formatVndInput(settings.openingCashBalance)} onChange={e => setSettings({ ...settings, openingCashBalance: String(parseVndInput(e.target.value)) })} /></label>
          <label className="block"><span className={labelClass}>Tiết kiệm ban đầu</span><input inputMode="numeric" className={mobileInputClass + " text-right"} value={formatVndInput(settings.openingSavingsBalance)} onChange={e => setSettings({ ...settings, openingSavingsBalance: String(parseVndInput(e.target.value)) })} /></label>`;
const r_ui = `          <label className="block"><span className={labelClass}>Tiền mặt ban đầu</span><input inputMode="numeric" className={mobileInputClass + " text-right"} value={formatVndInput(settings.openingCashAmount)} onChange={e => setSettings({ ...settings, openingCashAmount: String(parseVndInput(e.target.value)) })} /></label>
          <label className="block"><span className={labelClass}>Tài khoản / Thẻ ghi nợ ban đầu</span><input inputMode="numeric" className={mobileInputClass + " text-right"} value={formatVndInput(settings.openingDebitAmount)} onChange={e => setSettings({ ...settings, openingDebitAmount: String(parseVndInput(e.target.value)) })} /></label>
          <label className="block"><span className={labelClass}>Ví điện tử ban đầu</span><input inputMode="numeric" className={mobileInputClass + " text-right"} value={formatVndInput(settings.openingWalletAmount)} onChange={e => setSettings({ ...settings, openingWalletAmount: String(parseVndInput(e.target.value)) })} /></label>
          <label className="block"><span className={labelClass}>Tiết kiệm ban đầu</span><input inputMode="numeric" className={mobileInputClass + " text-right"} value={formatVndInput(settings.openingSavingsBalance)} onChange={e => setSettings({ ...settings, openingSavingsBalance: String(parseVndInput(e.target.value)) })} /></label>`;
content = content.replace(t_ui, r_ui);

// 6. calculateMonthlyUsableBalanceInfo
const t_calc = `  const trackingStartDate = new Date(trackingStartYear, trackingStartMonth - 1, 1);
  const openingCashBalance = Number(settings?.openingCashBalance || 0);

  const currentMonthDate = new Date(year, month - 1, 1);

  let beginningBalance = openingCashBalance;`;

const r_calc = `  const trackingStartDate = new Date(trackingStartYear, trackingStartMonth - 1, 1);
  const initialCash = Number(settings?.openingCashAmount || 0);
  const initialDebit = Number(settings?.openingDebitAmount || 0);
  const initialWallet = Number(settings?.openingWalletAmount || 0);
  let openingCashBalance = initialCash + initialDebit + initialWallet;
  if (openingCashBalance === 0 && Number(settings?.openingCashBalance || 0) > 0) openingCashBalance = Number(settings.openingCashBalance);

  const currentMonthDate = new Date(year, month - 1, 1);

  let beginningBalance = openingCashBalance;`;
content = content.replace(t_calc, r_calc);

const t_calcHand = `  let totalMoneyOnHand = openingCashBalance;
  toArray(incomes).forEach((inc: any) => {`;
const r_calcHand = `  let totalMoneyOnHand = openingCashBalance;
  toArray(incomes).forEach((inc: any) => {`;
content = content.replace(t_calcHand, r_calcHand);

fs.writeFileSync(file, content);
console.log("Patched Finance Settings in frontend");
