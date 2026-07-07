const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const pristineStart = `<div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">`;
const pristineEnd = `    </div>`;
let idxStart = content.indexOf(pristineStart);
let idxEnd = content.indexOf(pristineEnd, idxStart) + pristineEnd.length;

if (idxStart !== -1 && idxEnd > idxStart) {
  const replacement = `      {monthlyInfo.isHistorical ? (
        <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)] text-center">
          <p className="text-[14px] font-medium text-[#171018]">Dữ liệu lịch sử</p>
          <p className="text-[12px] text-[#6B5E64] mt-1 mb-3">Không tính vào số dư hiện tại</p>
          <div className="grid grid-cols-3 gap-2 text-left">
            <div className="rounded-lg bg-[#F8F5F2] p-2 text-center">
              <span className="block text-[11px] text-[#6B5E64]">Tổng thu</span>
              <span className="block font-semibold text-[#059669] text-[13px]">{money(monthlyInfo.incomeTotal)}</span>
            </div>
            <div className="rounded-lg bg-[#F8F5F2] p-2 text-center">
              <span className="block text-[11px] text-[#6B5E64]">Tổng chi</span>
              <span className="block font-semibold text-[#E11D48] text-[13px]">{money(monthlyInfo.expenseTotal)}</span>
            </div>
            <div className="rounded-lg bg-[#F8F5F2] p-2 text-center">
              <span className="block text-[11px] text-[#6B5E64]">Tiết kiệm</span>
              <span className="block font-semibold text-[#800020] text-[13px]">{money(monthlyInfo.savingsTotal)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="contents">
          <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[13px] font-semibold text-[#6B5E64]">Tiền dùng được:</span>
              <span className="font-bold text-[18px] text-[#059669]">{loadingOverview ? "..." : money(currentCash)}</span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[13px] font-semibold text-[#6B5E64]">Nợ thẻ tín dụng:</span>
              <span className="font-bold text-[#E11D48]">{loadingOverview ? "..." : (typeof pendingCredit !== 'undefined' ? money(pendingCredit) : "0 đ")}</span>
            </div>
            <div className="flex justify-between items-center pt-2 mt-2 border-t border-[#E8DCD5]/50 text-[14px]">
              <span className="text-[#800020] font-medium">Sau khi trả thẻ:</span>
              <span className="font-bold text-[#800020]">{loadingOverview ? "..." : (typeof pendingCredit !== 'undefined' ? money(currentCash - pendingCredit) : money(currentCash))}</span>
            </div>
          </div>

          <details className="group mb-3">
            <summary className="text-[12px] font-medium text-[#800020] cursor-pointer list-none flex items-center justify-center gap-1 py-1">
              <span>Chi tiết</span>
              <svg className="size-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </summary>
            <div className="mt-2 space-y-1.5 text-[12px] text-[#6B5E64] pt-2 border-t border-[#E8DCD5]/50">
               <div className="flex justify-between items-center">
                 <span>Dư đầu tháng:</span>
                 <span className="font-semibold text-[#171018]">{money(monthlyInfo.beginningBalance)}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span>Thu tháng này:</span>
                 <span className="font-semibold text-[#171018]">{money(monthlyInfo.incomeTotal)}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span>Chi thật tháng này:</span>
                 <span className="font-semibold text-[#171018]">{money(monthlyInfo.expenseTotal)}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span>Tiết kiệm tháng này:</span>
                 <span className="font-semibold text-[#171018]">{money(monthlyInfo.savingsTotal)}</span>
               </div>
               <div className="flex justify-between items-center pt-1 mt-1 border-t border-[#E8DCD5]/50">
                 <span>Ban đầu (Tiền mặt):</span>
                 <span className="font-semibold text-[#171018]">{money(overviewData?.settings?.openingCashAmount || 0)}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span>Ban đầu (Thẻ/TK):</span>
                 <span className="font-semibold text-[#171018]">{money(overviewData?.settings?.openingDebitAmount || 0)}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span>Ban đầu (Ví điện tử):</span>
                 <span className="font-semibold text-[#171018]">{money(overviewData?.settings?.openingWalletAmount || 0)}</span>
               </div>
            </div>
          </details>
        </div>
      )}
      
      <div className="grid grid-cols-3 border-t border-[#E8DCD5] pt-3 gap-1">
        {([['all', 'Chi tiết'], ['income', 'Thu nhập'], ['expense', 'Chi tiêu']] as const).map(([value, label]) => (
          <button key={value} onClick={() => setSubTab(value as any)} className={\`min-w-0 rounded-lg px-1 py-2 text-[13px] transition-colors \${subTab === value ? "bg-[#800020] border border-transparent font-semibold text-white shadow-sm" : "bg-[#F8E7EC] border border-[#E8DCD5] font-medium text-[#800020] active:opacity-70"}\`}>{label}</button>
        ))}
      </div>`;
  
  content = content.substring(0, idxStart) + replacement + content.substring(idxEnd);
  fs.writeFileSync(file, content);
  console.log("Successfully replaced pristine Mobile UI block.");
} else {
  console.log("Could not find the block to replace.");
}
