const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetUI = `<div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
      <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Có thể dùng tháng này</p>
      <b className={\`block break-words text-[clamp(23px,7.5vw,31px)] font-bold leading-tight tracking-tight \${availableThisMonth >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>{money(availableThisMonth)}</b>
      <p className="mb-3 mt-2 text-[11px] leading-4 text-[#6B5E64]">Tiền đang có hiện tại: <span className="font-semibold text-[#171018]">{loadingOverview ? "..." : (overviewDataCache[year] ? money(totalMoneyOnHand) : "-")}</span></p>`;

const replacementUI = `{isHistorical ? (
      <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[#F8F5F2] p-4 text-center shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
        <p className="text-[14px] font-medium text-[#6B5E64]">Dữ liệu lịch sử</p>
        <p className="text-[12px] text-[#9A8F95] mt-1">Không tính vào số dư hiện tại</p>
      </div>
    ) : (
      <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
        <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Có thể dùng tháng này</p>
        <b className={\`block break-words text-[clamp(23px,7.5vw,31px)] font-bold leading-tight tracking-tight \${availableThisMonth >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>{money(availableThisMonth)}</b>
        
        <div className="mt-4 pt-3 border-t border-[#E8DCD5]/50 space-y-1">
          <div 
            className="flex justify-between items-center cursor-pointer active:opacity-70 group" 
            onClick={() => setShowCreditPendingSheet && setShowCreditPendingSheet(true)}
          >
            <span className="text-[13px] font-semibold text-[#6B5E64] flex items-center gap-1 group-hover:text-[#800020]">
              Nợ thẻ tín dụng
              <svg className="size-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </span>
            <span className="font-bold text-[#E11D48]">{typeof pendingCredit !== 'undefined' ? money(pendingCredit) : "0 đ"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] font-medium text-[#6B5E64]">Sau khi trả thẻ</span>
            <span className="font-semibold text-[#171018]">{typeof pendingCredit !== 'undefined' ? money(availableThisMonth - pendingCredit) : money(availableThisMonth)}</span>
          </div>
        </div>
      </div>
    )}
    <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]" style={{ display: isHistorical ? 'none' : 'block' }}>
      <p className="mb-3 text-[11px] leading-4 text-[#6B5E64]">Tiền đang có hiện tại: <span className="font-semibold text-[#171018]">{loadingOverview ? "..." : (overviewDataCache[year] ? money(totalMoneyOnHand) : "-")}</span></p>`;

if (content.includes(targetUI)) {
  content = content.replace(targetUI, replacementUI);
  fs.writeFileSync(file, content);
  console.log("Replaced UI in family-app.tsx");
} else {
  console.log("UI Target not found!");
}
