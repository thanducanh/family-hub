const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

// The target we want to replace is the UI rendering for the balance container
const targetHtml = `<div className="relative mb-4 mt-2 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#171018] to-[#2D202F] p-5 text-white shadow-xl">
          <div className="relative z-10 flex flex-col items-center">
            <p className="text-[14px] font-medium text-white/80">Tiền dùng được</p>
            <b className={\`block break-words text-[clamp(23px,7.5vw,31px)] font-bold leading-tight tracking-tight \${availableThisMonth >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>{money(availableThisMonth)}</b>
          </div>
          <div className="absolute right-0 top-0 -mr-6 -mt-6 size-32 rounded-full bg-white/5 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-6 -ml-6 size-24 rounded-full bg-white/5 blur-xl"></div>
        </div>`;

const replacementHtml = `
        {isHistorical ? (
          <div className="relative mb-4 mt-2 overflow-hidden rounded-[20px] bg-[#F8F5F2] border border-[#E8DCD5] p-5 text-center shadow-sm">
            <p className="text-[14px] font-medium text-[#6B5E64]">Dữ liệu lịch sử</p>
            <p className="text-[12px] text-[#9A8F95] mt-1">Không tính vào số dư hiện tại</p>
          </div>
        ) : (
          <div className="relative mb-4 mt-2 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#171018] to-[#2D202F] p-5 text-white shadow-xl">
            <div className="relative z-10 flex flex-col items-center">
              <p className="text-[14px] font-medium text-white/80">Tiền dùng được</p>
              <b className={\`block break-words text-[clamp(23px,7.5vw,31px)] font-bold leading-tight tracking-tight \${availableThisMonth >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>{money(availableThisMonth)}</b>
            </div>
            
            <div className="mt-4 pt-3 border-t border-white/10 space-y-1">
              <div 
                className="flex justify-between items-center cursor-pointer active:opacity-70 group" 
                onClick={() => setShowCreditPendingSheet && setShowCreditPendingSheet(true)}
              >
                <span className="text-[13px] font-medium text-white/70 flex items-center gap-1">
                  Nợ thẻ tín dụng
                  <svg className="size-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </span>
                <span className="font-semibold text-white/90">{typeof pendingCredit !== 'undefined' ? money(pendingCredit) : "0 đ"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] font-medium text-white/70">Sau khi trả thẻ</span>
                <span className="font-semibold text-white/90">{typeof pendingCredit !== 'undefined' ? money(availableThisMonth - pendingCredit) : money(availableThisMonth)}</span>
              </div>
            </div>

            <div className="absolute right-0 top-0 -mr-6 -mt-6 size-32 rounded-full bg-white/5 blur-2xl"></div>
            <div className="absolute bottom-0 left-0 -mb-6 -ml-6 size-24 rounded-full bg-white/5 blur-xl"></div>
          </div>
        )}
`;

if (content.includes(targetHtml)) {
  content = content.replace(targetHtml, replacementHtml);
  fs.writeFileSync(file, content);
  console.log("Replaced UI in family-app.tsx");
} else {
  console.log("UI Target not found!");
}
