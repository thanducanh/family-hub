const fs = require('fs');
let c = fs.readFileSync('src/components/family-app.tsx', 'utf8');

const startStr = 'function MemberJobDetail({ job, records, year, close, edit }';
const endStr = '\nfunction MemberJobSheet(';

const startIdx = c.indexOf(startStr);
const endIdx = c.indexOf(endStr, startIdx);

const newJobDetail = `function MemberJobDetail({ job, records, year, close, edit }: { job: MemberJob; records: IncomeRecord[]; year: string; close: () => void; edit: () => void }) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm sm:p-4">
    <div className="flex w-full max-w-2xl flex-col bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-4">
        <div><h3 className="text-lg font-bold">{job.title}</h3><p className="text-sm text-slate-500">{job.company}</p></div>
        <button onClick={close} className="grid size-8 place-items-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20">X</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Info label="Thời gian làm" value={jobYearRange(job)} />
          <Info label="Trạng thái" value={job.status === "active" ? "Đang làm" : "Đã nghỉ"} />
          <Info label="Tổng thu đã nhận" value={money(jobYearTotal(job, records))} />
          <div className="col-span-2 rounded-xl border border-[var(--app-border)] p-3 sm:col-span-4"><p className="text-xs text-slate-400">Ghi chú</p><p className="mt-1 text-sm">{job.note || "Không có"}</p></div>
        </div>
        <div className="mt-8">
          <h4 className="mb-4 text-base font-bold">Thống kê thu nhập năm {year}</h4>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {months.map(month => {
              const total = jobMonthTotal(job, records, month);
              return <div key={month} className="rounded-xl border border-[var(--app-border)] bg-slate-50 p-3 text-center dark:bg-white/5"><p className="text-xs font-semibold text-slate-500">Tháng {month}</p><b className={\`mt-1 block text-sm \${total > 0 ? "text-emerald-500" : "text-slate-400"}\`}>{money(total)}</b></div>;
            })}
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--app-border)] px-6 py-4 flex justify-end gap-3">
        <button onClick={close} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">Đóng</button>
        <button onClick={edit} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Chỉnh sửa công việc</button>
      </div>
    </div>
  </div>;
}`;

c = c.substring(0, startIdx) + newJobDetail + c.substring(endIdx);
fs.writeFileSync('src/components/family-app.tsx', c);
console.log('Replaced MemberJobDetail');
