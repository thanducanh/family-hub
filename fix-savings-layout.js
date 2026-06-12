const fs = require('fs');

let app = fs.readFileSync('src/components/family-app.tsx', 'utf8');

// 1. Array.from({ length: 12 }, (_, i) => 12 - i) -> (_, i) => i + 1
app = app.replace(
  '{Array.from({ length: 12 }, (_, i) => 12 - i).map(month => {',
  '{Array.from({ length: 12 }, (_, i) => i + 1).map(month => {'
);

// 2. Order of columns: amount -> count -> icon
const oldRow = `
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">{monthRecords.length} khoản</span>
                    <b className={monthTotal >= 0 ? "text-emerald-500" : "text-rose-500"}>{money(monthTotal)}</b>
                    <span className={\`text-slate-400 transition-transform \${expanded ? "rotate-180" : ""}\`}>▼</span>
                  </div>
`;
const newRow = `
                  <div className="flex items-center gap-4 text-sm">
                    <b className={monthTotal >= 0 ? "text-emerald-500" : "text-rose-500"}>{money(monthTotal)}</b>
                    <span className="text-slate-500">{monthRecords.length} khoản</span>
                    <span className={\`text-slate-400 transition-transform \${expanded ? "rotate-180" : ""}\`}>▼</span>
                  </div>
`;
app = app.replace(oldRow.trim(), newRow.trim());

// 3. Remove thead to make it a simple list and change bg-slate-50 to plain to avoid card-in-card feel
const oldExpanded = `
                {expanded && (
                  <div className="border-t border-[var(--app-border)] bg-slate-50 overflow-x-auto dark:bg-white/5">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="text-xs text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Loại</th>
                          <th className="px-4 py-3">Nội dung</th>
                          <th className="px-4 py-3">Nơi giữ</th>
                          <th className="px-4 py-3 text-right">Số tiền</th>
                          <th className="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--app-border)]">
`;
const newExpanded = `
                {expanded && (
                  <div className="border-t border-[var(--app-border)] overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <tbody className="divide-y divide-[var(--app-border)] bg-slate-50/50 dark:bg-white/5">
`;
app = app.replace(oldExpanded.trim(), newExpanded.trim());

fs.writeFileSync('src/components/family-app.tsx', app, 'utf8');
console.log('Fixed Savings UI Layout');
