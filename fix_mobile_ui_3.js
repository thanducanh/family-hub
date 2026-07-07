const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1. MobileTransactionList patch for the overview box and Adjustment Modal
const t_mobileTxList = `    <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
      <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Có thể dùng tháng này</p>
      <b className={\`block break-words text-[clamp(23px,7.5vw,31px)] font-bold leading-tight tracking-tight \${availableThisMonth >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>{money(availableThisMonth)}</b>
      
      <div className="mt-3 mb-4 space-y-1.5 text-[12px] text-[#6B5E64]">
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
        {pendingCredit > 0 && (
          <div className="flex justify-between items-center pt-1 mt-1 border-t border-[#E8DCD5]/50">
            <span className="text-[#800020]">Sau khi trả thẻ dự kiến:</span>
            <span className="font-bold text-[#800020]">{money(availableThisMonth - pendingCredit)}</span>
          </div>
        )}
      </div>

      <p className="mb-3 mt-2 text-[11px] leading-4 text-[#6B5E64] flex justify-between items-center">
        <span>Tiền đang có hiện tại:</span>
        <span className="font-semibold text-[#171018]">{loadingOverview ? "..." : money(monthlyInfo.totalMoneyOnHand)}</span>
      </p>
      
      <div className="grid grid-cols-3 border-t border-[#E8DCD5] pt-3 gap-1">
        {([['all', 'Chi tiết'], ['income', 'Thu nhập'], ['expense', 'Chi tiêu']] as const).map(([value, label]) => (
          <button key={value} onClick={() => setSubTab(value)} className={\`min-w-0 rounded-lg px-1 py-2 text-[13px] transition-colors \${subTab === value ? "bg-[#800020] border border-transparent font-semibold text-white shadow-sm" : "bg-[#F8E7EC] border border-[#E8DCD5] font-medium text-[#800020] active:opacity-70"}\`}>{label}</button>
        ))}
      </div>

    </div>`;

const r_mobileTxList = `    <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Tiền dùng được</p>
          <div className="flex items-center gap-2">
            <b className={\`text-[clamp(23px,7.5vw,31px)] font-bold leading-tight tracking-tight \${currentCash >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>
              {loadingOverview ? "..." : money(currentCash)}
            </b>
            <button aria-label="Điều chỉnh số dư" onClick={() => setAdjForm({ month, year, amount: "", note: "", sourceType: "cash" })} className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-slate-800">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
          </div>
        </div>
      </div>
      
      <div className="mb-4 space-y-1.5 text-[12px] text-[#6B5E64]">
        <div className="flex justify-between items-center">
          <span>Nợ thẻ tín dụng:</span>
          <span className="font-semibold text-[#E11D48]">{money(pendingCredit)}</span>
        </div>
        <div className="flex justify-between items-center pt-1 mt-1 border-t border-[#E8DCD5]/50">
          <span className="text-[#800020] font-medium">Sau khi trả thẻ:</span>
          <span className="font-bold text-[#800020]">{loadingOverview ? "..." : money(currentCash - pendingCredit)}</span>
        </div>
      </div>

      <details className="group mb-3">
        <summary className="text-[12px] font-medium text-[#800020] cursor-pointer list-none flex items-center justify-center gap-1 py-1">
          <span>Chi tiết</span>
          <svg className="size-3.5 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </summary>
        <div className="mt-2 space-y-1.5 text-[12px] text-[#6B5E64] pt-2 border-t border-[#E8DCD5]/50">
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
             <span className="font-semibold text-[#171018]">{money(monthlyInfo.savingsThisMonth)}</span>
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
      
      <div className="grid grid-cols-3 border-t border-[#E8DCD5] pt-3 gap-1">
        {(subTab === "all" ? [['all', 'Tất cả'], ['income', 'Thu nhập'], ['expense', 'Chi tiêu']] : [['all', 'Chi tiết'], ['income', 'Thu nhập'], ['expense', 'Chi tiêu']] as const).map(([value, label]) => (
          <button key={value} onClick={() => setSubTab(value as any)} className={\`min-w-0 rounded-lg px-1 py-2 text-[13px] transition-colors \${subTab === value ? "bg-[#800020] border border-transparent font-semibold text-white shadow-sm" : "bg-[#F8E7EC] border border-[#E8DCD5] font-medium text-[#800020] active:opacity-70"}\`}>{label}</button>
        ))}
      </div>
    </div>`;
content = content.replace(t_mobileTxList, r_mobileTxList);


// 3. Render Adjustment Form Modal at the bottom of MobileTransactionList
const t_MobileTransactionListReturn = `    {showCreditPendingSheet && <CreditPendingSheet close={() => setShowCreditPendingSheet(false)} summaries={pendingCreditSummaries} refresh={refresh} />}
  </div>;
}`;
const r_MobileTransactionListReturn = `    {showCreditPendingSheet && <CreditPendingSheet close={() => setShowCreditPendingSheet(false)} summaries={pendingCreditSummaries} refresh={refresh} />}
    {adjForm && (
      <FullScreenMobileSheet close={() => setAdjForm(null)}>
        <div className="flex items-center justify-between border-b border-[var(--app-border)] p-4 bg-[var(--app-nav)] sticky top-0 z-10">
          <h2 className="text-lg font-bold">Điều chỉnh số dư</h2>
          <button onClick={() => setAdjForm(null)} className="rounded-full bg-slate-100 p-2 dark:bg-white/10 text-slate-500"><svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-4">
          <form onSubmit={submitAdjustment} className="space-y-4">
            <Field label="Nguồn tiền">
              <select className="flex h-11 w-full items-center justify-between rounded-xl border-none bg-white px-3 text-[15px] font-semibold text-[#171018] shadow-sm outline-none ring-1 ring-inset ring-[#E8DCD5] focus:ring-2 focus:ring-inset focus:ring-[#800020]" value={adjForm.sourceType} onChange={e => setAdjForm({ ...adjForm, sourceType: e.target.value })}>
                <option value="cash">Tiền mặt</option>
                <option value="debit">Tài khoản / Thẻ ghi nợ</option>
                <option value="wallet">Ví điện tử</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tháng"><select className="flex h-11 w-full items-center justify-between rounded-xl border-none bg-white px-3 text-[15px] font-semibold text-[#171018] shadow-sm outline-none ring-1 ring-inset ring-[#E8DCD5]" value={adjForm.month} onChange={e => setAdjForm({ ...adjForm, month: Number(e.target.value) })}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)}</select></Field>
              <Field label="Năm"><input type="number" className="flex h-11 w-full items-center justify-between rounded-xl border-none bg-white px-3 text-[15px] font-semibold text-[#171018] shadow-sm outline-none ring-1 ring-inset ring-[#E8DCD5]" value={adjForm.year} onChange={e => setAdjForm({ ...adjForm, year: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Số tiền điều chỉnh (+/-)"><input required type="text" className="flex h-11 w-full items-center justify-between rounded-xl border-none bg-white px-3 text-[15px] font-semibold text-[#171018] shadow-sm outline-none ring-1 ring-inset ring-[#E8DCD5] text-right" placeholder="VD: 500000 hoặc -200000" value={adjForm.amount} onChange={e => setAdjForm({ ...adjForm, amount: e.target.value })} /></Field>
            <Field label="Nội dung"><textarea required rows={3} className="flex min-h-[88px] w-full resize-none items-center justify-between rounded-xl border-none bg-white px-3 py-3 text-[15px] font-semibold text-[#171018] shadow-sm outline-none ring-1 ring-inset ring-[#E8DCD5]" value={adjForm.note} onChange={e => setAdjForm({ ...adjForm, note: e.target.value })} /></Field>
            <button disabled={adjusting || !adjForm.amount} className="w-full rounded-xl bg-[#800020] px-4 py-3 text-[14px] font-bold text-white active:scale-95 transition-transform disabled:opacity-50 mt-4">{adjusting ? "Đang xử lý..." : "Lưu điều chỉnh"}</button>
          </form>
        </div>
      </FullScreenMobileSheet>
    )}
  </div>;
}`;
content = content.replace(t_MobileTransactionListReturn, r_MobileTransactionListReturn);


// 4. Update the FinanceDashboard adjForm UI to include sourceType (lines 9272+)
const r_FinanceDashboardAdjForm = `            <form onSubmit={addAdjustment} className="space-y-3">
              <label className="block"><span className={labelClass}>Nguồn tiền</span><select className={mobileInputClass} value={adjForm.sourceType || "cash"} onChange={e => setAdjForm({ ...adjForm, sourceType: e.target.value })}><option value="cash">Tiền mặt</option><option value="debit">Tài khoản / Thẻ ghi nợ</option><option value="wallet">Ví điện tử</option></select></label>
              <div className="grid grid-cols-2 gap-3">`;
content = content.replace(
  /<form onSubmit=\{addAdjustment\} className="space-y-3">\s*<div className="grid grid-cols-2 gap-3">/g,
  r_FinanceDashboardAdjForm
);

let hasError = false;
if (!content.includes(r_mobileTxList)) { console.log("mobileTxList missing"); hasError = true; }
if (!content.includes(r_MobileTransactionListReturn)) { console.log("MobileTransactionListReturn missing"); hasError = true; }
if (!content.includes(r_FinanceDashboardAdjForm)) { console.log("FinanceDashboardAdjForm missing"); hasError = true; }
if (hasError) process.exit(1);

fs.writeFileSync(file, content);
console.log("Patched Mobile UI box (Rest 2)");
