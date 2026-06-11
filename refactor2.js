const fs = require('fs');
let content = fs.readFileSync('src/components/family-app.tsx', 'utf8');

// Trong table (desktop)
content = content.replace(
  '<td className="px-4 py-3">{record.name}</td>',
  '<td className="px-4 py-3 leading-tight">{record.jobId ? record.jobName : <>Thu khác<br /><span className="text-xs font-normal text-slate-500">{record.name}</span></>}</td>'
);

// Trong mobile view
content = content.replace(
  '<div><b>{record.name}</b><p className="text-xs text-slate-400">{formatDateVN(record.incomeDate)} · {record.memberName} · {record.category}</p></div>',
  '<div><b>{record.jobId ? record.jobName : "Thu khác"}</b>{record.jobId ? null : <p className="text-sm font-semibold text-slate-600">{record.name}</p>}<p className="mt-0.5 text-xs text-slate-400">{formatDateVN(record.incomeDate)} · {record.memberName} · {record.category}</p></div>'
);

// Thêm bảng Lương/Thu nhập vào MemberJobDetail
const jobDetailStart = content.indexOf('function MemberJobDetail({ job, records, year, close, edit }: { job: MemberJob; records: IncomeRecord[]; year: string; close: () => void; edit: () => void }) {');
const jobDetailEnd = content.indexOf('function MemberJobSheet({ job, memberId, year, close, saved }', jobDetailStart);

const newJobDetail = `function MemberJobDetail({ job, records, year, close, edit }: { job: MemberJob; records: IncomeRecord[]; year: string; close: () => void; edit: () => void }) {
  const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, amount: jobIncomeForMonth(job, records, index + 1) }));
  const jobRecords = records.filter(r => r.jobId === job.id);
  const [showForm, setShowForm] = useState(false);
  
  return <Sheet close={close}><div className="space-y-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-slate-400">{jobYearRange(job)}</p><h2 className="mt-1 text-lg font-bold">{job.title}</h2><p className="mt-1 text-sm text-slate-400">{job.company}</p></div><button onClick={edit} className="rounded-xl border border-[var(--app-border)] px-3 py-2 text-xs font-bold">Sửa</button></div><div className="grid gap-3 sm:grid-cols-2"><AccountDetail label="Thời gian" value={jobYearRange(job)} /><AccountDetail label="Trạng thái" value={job.status === "active" ? "Đang làm" : "Đã nghỉ"} /><AccountDetail label={\`Tổng thu nhập \${year}\`} value={money(jobYearTotal(job, records))} /></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{months.map(item => <div key={item.month} className="rounded-xl border border-[var(--app-border)] p-3"><p className="text-xs text-slate-400">Tháng {item.month}</p><b className="text-sm text-emerald-500">{money(item.amount)}</b></div>)}</div>{job.note && <p className="rounded-xl border border-[var(--app-border)] p-4 text-sm text-slate-500">{job.note}</p>}
  
  <div>
    <div className="mb-3 flex items-center justify-between">
      <h3 className="font-bold">Lương / Thu nhập công việc</h3>
      <button onClick={() => setShowForm(true)} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">+ Thêm thu nhập</button>
    </div>
    {jobRecords.length === 0 ? <p className="text-sm text-slate-400">Chưa có dữ liệu.</p> : <div className="space-y-2">{jobRecords.map(r => <div key={r.id} className="rounded-lg border border-[var(--app-border)] p-3 flex justify-between gap-3"><div><p className="text-sm font-bold">{formatDateVN(r.incomeDate)} · {r.category}</p><p className="text-sm">{r.name}</p><p className="text-xs text-slate-400">{r.note}</p></div><b className="text-emerald-500">{money(r.amount)}</b></div>)}</div>}
  </div>
  
  {showForm && <IncomeRecordForm record={null} members={[{id: job.memberId, name: ""}]} templates={[]} back={() => setShowForm(false)} saved={() => { setShowForm(false); window.location.reload(); }} fixedJobId={job.id} fixedMemberId={job.memberId} />}
  </div></Sheet>;
}
`;

content = content.substring(0, jobDetailStart) + newJobDetail + content.substring(jobDetailEnd);

fs.writeFileSync('src/components/family-app.tsx', content);
console.log("Done");
