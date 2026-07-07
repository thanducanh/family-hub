const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add normalizeCardType at the top of the file if not exists
const normalizeCardTypeHelper = `
function normalizeCardType(value: string | undefined | null): string {
  if (!value) return "other";
  const lower = String(value).toLowerCase().trim();
  if (lower === "credit" || lower.includes("thẻ tín dụng")) return "credit";
  if (lower === "debit" || lower.includes("ghi nợ") || lower.includes("atm")) return "debit";
  if (lower === "bank_account" || lower.includes("tài khoản")) return "bank_account";
  if (lower === "wallet" || lower.includes("ví điện tử")) return "wallet";
  if (lower === "cash" || lower.includes("tiền mặt")) return "cash";
  return "other";
}
`;

if (!content.includes('function normalizeCardType')) {
  // Insert right before export default function FamilyHubApp
  content = content.replace('export default function FamilyHubApp() {', normalizeCardTypeHelper + '\nexport default function FamilyHubApp() {');
}

// 1. Update availableThisMonth computation in MobileTransactionList
// Replace the inline computation logic I added earlier with using the backend fields.
// The regex finds the previous `isHistorical` block until `pendingCredit = Number(...)`.
const calcRegex = /const currentMonthDate = new Date.*?const pendingCredit = [^\n]+/s;

const newCalc = `
  const isHistorical = year < trackingStartYear || (year === trackingStartYear && month < trackingStartMonth);
  const availableThisMonth = Number(overviewDataCache[year]?.availableCash ?? 0);
  const pendingCredit = Number(overviewDataCache[year]?.pendingCreditTotal ?? 0);
  const afterCreditPayment = Number(overviewDataCache[year]?.afterCreditPayment ?? 0);
`;
if (calcRegex.test(content)) {
  content = content.replace(calcRegex, newCalc);
}

// 2. Update the UI rendering of the Tiền dùng được box
const uiRegex = /\{isHistorical \? \([\s\S]*?Tiền đang có hiện tại:.*?<\/p>/;
const newUI = `{isHistorical ? (
      <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[#F8F5F2] p-4 text-center shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
        <p className="text-[14px] font-medium text-[#6B5E64]">Dữ liệu lịch sử</p>
        <p className="text-[12px] text-[#9A8F95] mt-1">Không tính vào số dư hiện tại</p>
      </div>
    ) : (
      <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
        <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Tiền dùng được</p>
        <b className={\`block break-words text-[clamp(23px,7.5vw,31px)] font-bold leading-tight tracking-tight \${availableThisMonth >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>{loadingOverview ? "..." : money(availableThisMonth)}</b>
        
        <div className="mt-4 pt-3 border-t border-[#E8DCD5]/50 space-y-1">
          <div 
            className="flex justify-between items-center cursor-pointer active:opacity-70 group" 
            onClick={() => setShowCreditPendingSheet && setShowCreditPendingSheet(true)}
          >
            <span className="text-[13px] font-semibold text-[#6B5E64] flex items-center gap-1 group-hover:text-[#800020]">
              Nợ thẻ tín dụng
              <svg className="size-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </span>
            <span className="font-bold text-[#E11D48]">{loadingOverview ? "..." : money(pendingCredit)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] font-medium text-[#6B5E64]">Sau khi trả thẻ</span>
            <span className="font-semibold text-[#171018]">{loadingOverview ? "..." : money(afterCreditPayment)}</span>
          </div>
        </div>
      </div>
    )}
    <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]" style={{ display: isHistorical ? 'none' : 'block' }}>
      <p className="mb-1 text-[11px] leading-4 text-[#6B5E64]">Tiền đang có hiện tại: <span className="font-semibold text-[#171018]">{loadingOverview ? "..." : (overviewDataCache[year] ? money(totalMoneyOnHand) : "-")}</span></p>`;

if (uiRegex.test(content)) {
  content = content.replace(uiRegex, newUI);
}

// 3. Update CreditPendingSheet
const sheetRegex = /const creditCards = allAccounts\.filter\(a => a\.type === "credit_card" \|\| a\.type === "credit" \|\| String\(a\.cardType\)\.toLowerCase\(\) === "credit"\);/;
const newSheetLogic = `const creditCards = allAccounts.filter(a => normalizeCardType(a.cardType) === "credit" || normalizeCardType(a.type) === "credit");`;

if (sheetRegex.test(content)) {
  content = content.replace(sheetRegex, newSheetLogic);
}

// 4. Also inside CreditPendingSheet, update the button to trigger "Thanh toán thẻ" functionality if needed.
// Right now, I will see how to do it.

fs.writeFileSync(file, content);
console.log("Patched family-app.tsx partially.");
