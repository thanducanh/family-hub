const fs = require('fs');

let app = fs.readFileSync('src/components/family-app.tsx', 'utf8');

app = app.replace(
  'className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"',
  'className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm"'
);

app = app.replace(
  'className="w-full max-w-sm rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] p-6 shadow-2xl"',
  'className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800"'
);

app = app.replace(
  '<h3 className="mb-4 text-lg font-bold">Cài đặt dòng tiền</h3>',
  '<h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">Cài đặt dòng tiền</h3>'
);

app = app.replace(
  '<p className="mb-4 text-xs text-slate-500">Chỉ các giao dịch từ tháng bắt đầu trở đi mới dùng để tính Tiền hiện tại.</p>',
  '<p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Chỉ các giao dịch từ tháng bắt đầu trở đi mới dùng để tính Tiền hiện tại.</p>'
);

fs.writeFileSync('src/components/family-app.tsx', app, 'utf8');
console.log('Fixed FinanceOverview Modal CSS');
