const fs = require('fs');

let app = fs.readFileSync('src/components/family-app.tsx', 'utf8');

// --- A. SavingsSheet ---
const savingsFixStr = `
  const payload = data || {};
  const savingsRecords = Array.isArray(data)
    ? data
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.records)
        ? payload.records
        : Array.isArray(payload.monthlyData)
          ? payload.monthlyData
          : [];
`;

app = app.replace(
  '{data.map(item => {',
  `${savingsFixStr}\n              {savingsRecords.map(item => {`
);

// B. Khôi phục tab Đầu tư bị mất giao diện
// In InvestmentSheet, we need to add the toolbar
// I will check InvestmentSheet structure
const invSearchIdx = app.indexOf('function InvestmentSheet');
if (invSearchIdx !== -1) {
  const invEndIdx = app.indexOf('return (', invSearchIdx);
  const invJSXEndIdx = app.indexOf('<Card className="overflow-hidden p-0">', invEndIdx);
  
  if (invJSXEndIdx !== -1 && !app.substring(invEndIdx, invJSXEndIdx).includes('<select')) {
    // Missing toolbar
    const toolbar = `
      <div className="flex gap-3">
        <select className={filterClass} style={{ width: "130px" }} value={yearStr} onChange={event => setYearStr(event.target.value)}>
          {Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}
        </select>
        <div className="flex-1">
          <input className={filterClass} placeholder="Tìm mã cổ phiếu..." value={viewStock || ""} onChange={e => setViewStock(e.target.value.toUpperCase())} />
        </div>
        <button onClick={() => setView("new")} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white whitespace-nowrap">+ Thêm</button>
      </div>
    `;
    app = app.replace(
      '<div className="space-y-5">',
      '<div className="space-y-5">\n' + toolbar
    );
  }
}

// C. Tổng quan
// - Cài đặt dòng tiền
// - Card Tổng quan (Thu tháng này, Chi tháng này, Dư sau chi tháng này, Tiết kiệm chuyển tháng này, Đầu tư ròng tháng này, Tiền hiện tại dự kiến)
// - Bảng Dòng tiền tháng
// - Đổi tên "Tiết kiệm năm" thành "Dư sau chi tiêu"
app = app.replace(
  'Tiết kiệm năm',
  'Dư sau chi tiêu'
);

// D. Defensive data format (already applied in replace scripts before, but I'll add the check for InvestmentSheet and FinanceOverview)
app = app.replace(
  'const monthlyData = Array.isArray(data)',
  'const payload = data || {};\n  const monthlyData = Array.isArray(data)'
);

fs.writeFileSync('src/components/family-app.tsx', app, 'utf8');
console.log('Processed basics');
