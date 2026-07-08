const fs = require('fs');

let c = fs.readFileSync('src/components/family-app.tsx', 'utf8');

// Replace the top box in Thu Chi (Lines 3895-3898 roughly)
// It looks like:
// <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
//   <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Có thể dùng tháng này</p>
//   <b className={`block break-words text-[clamp(23px,7.5vw,31px)] font-bold leading-tight tracking-tight ${availableThisMonth >= 0 ? "text-[#059669]" : "text-[#E11D48]"}`}>{money(availableThisMonth)}</b>
//   <p className="mb-3 mt-2 text-[11px] leading-4 text-[#6B5E64]">Tiền đang có hiện tại: <span className="font-semibold text-[#171018]">{loadingOverview ? "..." : (overviewDataCache[year] ? money(totalMoneyOnHand) : "-")}</span></p>

const oldBoxRegex = /<div className="mb-3 rounded-\[20px\] border border-\[#E8DCD5\] bg-\[var\(--mobile-card\)\] p-4 text-\[#171018\] shadow-\[0_6px_18px_rgba\(128,0,32,0\.07\)\]">[\s\S]*?<p className="mb-3 mt-2 text-\[11px\] leading-4 text-\[#6B5E64\]">Tiền đang có hiện tại: <span className="font-semibold text-\[#171018\]">\{loadingOverview \? "\.\.\." : \(overviewDataCache\[year\] \? money\(totalMoneyOnHand\) : "-"\)\}<\/span><\/p>/;

const newBoxes = `<div className="mb-3 grid grid-cols-1 gap-2">
      <div className="rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
        <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Tiền dùng được</p>
        <b className={\`block break-words text-[clamp(23px,7.5vw,31px)] font-bold leading-tight tracking-tight \${availableThisMonth >= 0 ? "text-[#059669]" : "text-[#E11D48]"}\`}>{money(availableThisMonth)}</b>
        {pendingCredit > 0 && <p className="mb-0 mt-2 text-[12px] leading-4 text-[#6B5E64]">Sau khi trả thẻ: <span className="font-semibold text-[#171018]">{loadingOverview ? "..." : money(afterCreditPayment)}</span></p>}
      </div>
      {pendingCredit > 0 && (
        <div className="rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
          <div className="flex items-center justify-between">
            <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Tạm tính thẻ tín dụng</p>
          </div>
          <b className="block break-words text-[clamp(18px,6vw,24px)] font-bold leading-tight tracking-tight text-[#E11D48]">{money(pendingCredit)}</b>
        </div>
      )}
    </div>
    <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
`;

c = c.replace(oldBoxRegex, newBoxes);

// availableThisMonth definition
// Old: const availableThisMonth = Number(overviewDataCache[year]?.availableCash ?? 0);
// We need to fetch from monthlyData for this month.
const availableThisMonthOld = /const availableThisMonth = Number\(overviewDataCache\[year\]\?\.availableCash \?\? 0\);/;
const availableThisMonthNew = `const monthlyDataArray = overviewDataCache[year]?.monthlyData || [];
  const currentMonthData = monthlyDataArray.find((m: any) => m.month === month);
  const availableThisMonth = currentMonthData ? Number(currentMonthData.cumulativeCash || 0) : 0;`;

c = c.replace(availableThisMonthOld, availableThisMonthNew);

// Remove "Tiền đang có hiện tại" from settings tab as well
c = c.replace(/<div className="rounded-xl bg=\[#F8F5F2\] p-3"><p className="text-\[12px\] font-semibold text-\[#6B5E64\]">Tiền đang có hiện tại<\/p>.*?<\/div>/, '');


fs.writeFileSync('src/components/family-app.tsx', c);
console.log('Patched UI successfully.');
