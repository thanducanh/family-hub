const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_ui = `      <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[13px] font-semibold text-[#6B5E64]">Ti?n dA1ng `?c:</span>
          <span className="font-bold text-[18px] text-[#059669]">{loadingOverview ? "..." : money(currentCash)}</span>
        </div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[13px] font-semibold text-[#6B5E64]">N th tAn dng:</span>
          <span className="font-bold text-[#E11D48]">{loadingOverview ? "..." : money(pendingCredit)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 mt-2 border-t border-[#E8DCD5]/50 text-[14px]">
          <span className="text-[#800020] font-medium">Sau khi tr th:</span>
          <span className="font-bold text-[#800020]">{loadingOverview ? "..." : money(currentCash - pendingCredit)}</span>
        </div>
      </div>

      <details className="group mb-3">
        <summary className="text-[12px] font-medium text-[#800020] cursor-pointer list-none flex items-center justify-center gap-1 py-1">
          <span>Chi tit</span>
          <svg className="size-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </summary>
        <div className="mt-2 space-y-1.5 text-[12px] text-[#6B5E64] pt-2 border-t border-[#E8DCD5]/50">
           <div className="flex justify-between items-center">
             <span>Thu thAng nAy:</span>
             <span className="font-semibold text-[#171018]">{money(monthlyInfo.incomeTotal)}</span>
           </div>
           <div className="flex justify-between items-center">
             <span>Chi th-t thAng nAy:</span>
             <span className="font-semibold text-[#171018]">{money(monthlyInfo.expenseTotal)}</span>
           </div>
           <div className="flex justify-between items-center">
             <span>Tit kim thAng nAy:</span>
             <span className="font-semibold text-[#171018]">{money(monthlyInfo.savingsTotal)}</span>
           </div>
           <div className="flex justify-between items-center pt-1 mt-1 border-t border-[#E8DCD5]/50">
             <span>Ban ` u (Ti?n mt):</span>
             <span className="font-semibold text-[#171018]">{money(overviewData?.settings?.openingCashAmount || 0)}</span>
           </div>
           <div className="flex justify-between items-center">
             <span>Ban ` u (Th/TK):</span>
             <span className="font-semibold text-[#171018]">{money(overviewData?.settings?.openingDebitAmount || 0)}</span>
           </div>
           <div className="flex justify-between items-center">
             <span>Ban ` u (VA- `in t-):</span>
             <span className="font-semibold text-[#171018]">{money(overviewData?.settings?.openingWalletAmount || 0)}</span>
           </div>
        </div>
      </details>`;

const r_ui = `      {monthlyInfo.isHistorical ? (
        <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)] text-center">
          <p className="text-[14px] font-medium text-[#171018]">D liu l<ch s</p>
          <p className="text-[12px] text-[#6B5E64] mt-1 mb-2">KhA'ng tAnh vA o s\` d hin ti</p>
          <div className="grid grid-cols-3 gap-2 text-left">
            <div className="rounded-lg bg-[#F8F5F2] p-2 text-center">
              <span className="block text-[11px] text-[#6B5E64]">Tng thu</span>
              <span className="block font-semibold text-[#059669] text-[13px]">{money(monthlyInfo.incomeTotal)}</span>
            </div>
            <div className="rounded-lg bg-[#F8F5F2] p-2 text-center">
              <span className="block text-[11px] text-[#6B5E64]">Tng chi</span>
              <span className="block font-semibold text-[#E11D48] text-[13px]">{money(monthlyInfo.expenseTotal)}</span>
            </div>
            <div className="rounded-lg bg-[#F8F5F2] p-2 text-center">
              <span className="block text-[11px] text-[#6B5E64]">Tit kim</span>
              <span className="block font-semibold text-[#800020] text-[13px]">{money(monthlyInfo.savingsTotal)}</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[13px] font-semibold text-[#6B5E64]">Ti?n dA1ng `?c:</span>
              <span className="font-bold text-[18px] text-[#059669]">{loadingOverview ? "..." : money(currentCash)}</span>
            </div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[13px] font-semibold text-[#6B5E64]">N th tAn dng:</span>
              <span className="font-bold text-[#E11D48]">{loadingOverview ? "..." : money(pendingCredit)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 mt-2 border-t border-[#E8DCD5]/50 text-[14px]">
              <span className="text-[#800020] font-medium">Sau khi tr th:</span>
              <span className="font-bold text-[#800020]">{loadingOverview ? "..." : money(currentCash - pendingCredit)}</span>
            </div>
          </div>

          <details className="group mb-3">
            <summary className="text-[12px] font-medium text-[#800020] cursor-pointer list-none flex items-center justify-center gap-1 py-1">
              <span>Chi tit</span>
              <svg className="size-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </summary>
            <div className="mt-2 space-y-1.5 text-[12px] text-[#6B5E64] pt-2 border-t border-[#E8DCD5]/50">
              <div className="flex justify-between items-center">
                <span>D ` u thAng:</span>
                <span className="font-semibold text-[#171018]">{money(monthlyInfo.beginningBalance)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Thu thAng nAy:</span>
                <span className="font-semibold text-[#171018]">{money(monthlyInfo.incomeTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Chi th-t thAng nAy:</span>
                <span className="font-semibold text-[#171018]">{money(monthlyInfo.expenseTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Tit kim thAng nAy:</span>
                <span className="font-semibold text-[#171018]">{money(monthlyInfo.savingsTotal)}</span>
              </div>
              <div className="flex justify-between items-center pt-1 mt-1 border-t border-[#E8DCD5]/50">
                <span>Ban ` u (Ti?n mt):</span>
                <span className="font-semibold text-[#171018]">{money(overviewData?.settings?.openingCashAmount || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Ban ` u (Th/TK):</span>
                <span className="font-semibold text-[#171018]">{money(overviewData?.settings?.openingDebitAmount || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Ban ` u (VA- `in t-):</span>
                <span className="font-semibold text-[#171018]">{money(overviewData?.settings?.openingWalletAmount || 0)}</span>
              </div>
            </div>
          </details>
        </>
      )}`;

content = content.replace(t_ui, r_ui);

fs.writeFileSync(file, content);
console.log("Patched Mobile UI logic");
