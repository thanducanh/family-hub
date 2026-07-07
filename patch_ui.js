const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

const uiRegex = /\{isHistorical \? \([\s\S]*?<\/div>\s*<\/div>\s*\)\}\s*<div className="mb-3 rounded-\[20px\] border border-\[#E8DCD5\] bg-\[var\(--mobile-card\)\] p-4 text-\[#171018\] shadow-\[0_6px_18px_rgba\(128,0,32,0\.07\)\]" style=\{\{ display: isHistorical \? 'none' : 'block' \}\}>\s*<p className="mb-1 text-\[11px\] leading-4 text-\[#6B5E64\]">Tiền đang có hiện tại: <span className="font-semibold text-\[#171018\]">\{loadingOverview \? "\.\.\." : \(overviewDataCache\[year\] \? money\(totalMoneyOnHand\) : "-"\)\}<\/span><\/p>\s*<div className="grid grid-cols-3 border-t border-\[#E8DCD5\] pt-3 gap-1">\s*\{\(\[\['all', 'Chi tiết'\], \['income', 'Thu nhập'\], \['expense', 'Chi tiêu'\]\] as const\)\.map\(\(\[value, label\]\) => \(\s*<button key=\{value\} onClick=\{\(\) => setSubTab\(value\)\} className=\{`min-w-0 rounded-lg px-1 py-2 text-\[13px\] transition-colors \$\{subTab === value \? "bg-\[#800020\] border border-transparent font-semibold text-white shadow-sm" : "bg-\[#F8E7EC\] border border-\[#E8DCD5\] font-medium text-\[#800020\] active:opacity-70"}`\}>\{label\}<\/button>\s*\)\)\}\s*<\/div>\s*<\/div>/;

const replacement = `{isHistorical ? (
      <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[#F8F5F2] p-4 text-center shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
        <p className="text-[14px] font-medium text-[#6B5E64]">Dữ liệu lịch sử</p>
        <p className="text-[12px] text-[#9A8F95] mt-1">Không tính vào số dư hiện tại</p>
      </div>
    ) : (
      <>
        {/* Box A: Tiền dùng được */}
        <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
          <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Tiền dùng được</p>
          <b className={\`block break-words text-[clamp(23px,7.5vw,31px)] font-bold leading-tight tracking-tight \${availableThisMonth >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>{loadingOverview ? "..." : money(availableThisMonth)}</b>
          
          <div className="mt-3 pt-3 border-t border-[#E8DCD5]/50 flex justify-between items-center">
            <span className="text-[13px] font-medium text-[#6B5E64]">Sau khi trả thẻ</span>
            <span className="font-semibold text-[#171018]">{loadingOverview ? "..." : money(afterCreditPayment)}</span>
          </div>
        </div>

        {/* Box B: Tạm tính thẻ tín dụng */}
        <div 
          className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[#FFF5F7] p-4 text-[#171018] shadow-[0_6px_18px_rgba(225,29,72,0.07)] cursor-pointer active:opacity-70"
          onClick={() => setShowCreditPendingSheet && setShowCreditPendingSheet(true)}
        >
          <div className="flex justify-between items-center">
            <span className="text-[13px] font-semibold text-[#800020] flex items-center gap-1">
              Tạm tính thẻ tín dụng
              <svg className="size-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </span>
            <span className="font-bold text-[#E11D48] text-[15px]">{loadingOverview ? "..." : money(pendingCredit)}</span>
          </div>
        </div>
      </>
    )}
    <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-3 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
      <div className="grid grid-cols-3 gap-1">
        {([['all', 'Chi tiết'], ['income', 'Thu nhập'], ['expense', 'Chi tiêu']] as const).map(([value, label]) => (
          <button key={value} onClick={() => setSubTab(value)} className={\`min-w-0 rounded-lg px-1 py-2 text-[13px] transition-colors \${subTab === value ? "bg-[#800020] border border-transparent font-semibold text-white shadow-sm" : "bg-[#F8E7EC] border border-[#E8DCD5] font-medium text-[#800020] active:opacity-70"}\`}>{label}</button>
        ))}
      </div>
    </div>`;

if (uiRegex.test(content)) {
  content = content.replace(uiRegex, replacement);
  fs.writeFileSync(file, content);
  console.log("Patched Mobile UI in family-app.tsx");
} else {
  console.log("Failed to patch Mobile UI, target not found");
}
