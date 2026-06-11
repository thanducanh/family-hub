const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/components/family-app.tsx');
let c = fs.readFileSync(file, 'utf8');

const s = c.indexOf('const expenseCategories = ');
const e = c.indexOf('const bankNames = ');
if (s === -1 || e === -1) {
  console.log("Could not find bounds", s, e);
  process.exit(1);
}

const newExpenseCode = `const expenseCategories = ["Ăn uống", "Điện nước", "Sinh hoạt", "Mua sắm", "Y tế", "Xăng xe", "Internet", "Giải trí", "Khác"];
type ExpenseDraft = { id: string; memberId: string; date: string; category: string; vendor: string; totalAmount: string; note: string };

function ExpenseSheetManagement({ data, update }: { data: AppData; update: (data: AppData) => void }) {
  const [viewTab, setViewTab] = useState<"list" | "chart">("list");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<Transaction[]>(() => data.transactions.filter(item => item.type === "expense"));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const visibleRecords = records.filter(record => {
    if (categoryFilter !== "all" && record.category !== categoryFilter) return false;
    const haystack = [record.title, record.category, record.note].join(" ").toLocaleLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLocaleLowerCase()));
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const yearRecords = visibleRecords.filter(record => {
    const parsed = parseDate(record.date);
    return parsed && String(parsed.getFullYear()) === year;
  });
  const selectedMonth = month === "all" ? String(new Date().getMonth() + 1) : month;
  const monthRecords = yearRecords.filter(record => {
    const parsed = parseDate(record.date);
    return parsed && String(parsed.getMonth() + 1) === selectedMonth;
  });
  
  const totalMonth = monthRecords.reduce((sum, record) => sum + record.amount, 0);
  const totalYear = yearRecords.reduce((sum, record) => sum + record.amount, 0);
  
  const activeCategoriesCount = new Set(visibleRecords.map(r => r.category)).size;
  const categoryTotalForFilter = categoryFilter === "all" ? 0 : visibleRecords.filter(r => r.category === categoryFilter).reduce((sum, r) => sum + r.amount, 0);

  const byCategory = expenseCategories.map(category => ({ label: category, total: visibleRecords.filter(record => record.category === category).reduce((sum, record) => sum + record.amount, 0) })).filter(item => item.total > 0).sort((a, b) => b.total - a.total);
  
  const largest = visibleRecords.reduce<Transaction | null>((best, record) => !best || record.amount > best.amount ? record : best, null);
  
  const monthSummaryRows = Array.from(new Set(visibleRecords.map(record => {
    const parsed = parseDate(record.date);
    return parsed ? parsed.getMonth() + 1 : 0;
  }))).filter(Boolean).sort((a, b) => b - a).map(itemMonth => {
    const monthItems = visibleRecords.filter(record => {
      const parsed = parseDate(record.date);
      return parsed && parsed.getMonth() + 1 === itemMonth;
    });
    return { month: itemMonth, items: monthItems, total: monthItems.reduce((sum, record) => sum + record.amount, 0), count: monthItems.length };
  });

  const monthlyTotals = Array.from({ length: 12 }, (_, index) => index + 1).map(m => {
    const total = visibleRecords.filter(record => { const parsed = parseDate(record.date); return parsed && parsed.getMonth() + 1 === m && String(parsed.getFullYear()) === year; }).reduce((sum, record) => sum + record.amount, 0);
    return { month: m, total };
  });
  const maxMonth = Math.max(1, ...monthlyTotals.map(item => item.total));

  function toggle(id: string) {
    setExpandedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function remove(record: Transaction) {
    const response = await fetch(\`/api/transactions?id=\${encodeURIComponent(record.id)}\`, { method: "DELETE" });
    if (!response.ok) return;
    setRecords(current => current.filter(item => item.id !== record.id));
    update({ ...data, transactions: data.transactions.filter(item => item.id !== record.id) });
    setDeleting(null);
  }

  if (editing) {
    return (
      <ExpenseForm
        record={editing === "new" ? null : editing}
        members={data.members}
        close={() => setEditing(null)}
        saved={(record) => {
          setRecords(current => [record, ...current.filter(item => item.id !== record.id)]);
          update({ ...data, transactions: [record, ...data.transactions.filter(item => item.id !== record.id)] });
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="mb-4 inline-flex flex-wrap gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-1 text-sm font-bold">
        <button onClick={() => setViewTab("list")} className={\`rounded-lg px-4 py-2 \${viewTab === "list" ? "bg-rose-500 text-white" : "text-slate-500"}\`}>Danh sách</button>
        <button onClick={() => setViewTab("chart")} className={\`rounded-lg px-4 py-2 \${viewTab === "chart" ? "bg-rose-500 text-white" : "text-slate-500"}\`}>Biểu đồ</button>
      </div>

      <div className="grid gap-3 md:grid-cols-[90px_100px_140px_minmax(180px,1fr)_auto]">
        <select className={filterClass} value={year} onChange={event => setYear(event.target.value)}>{Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}</select>
        <select className={filterClass} value={month} onChange={event => setMonth(event.target.value)}><option value="all">Tháng</option>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Tháng {index + 1}</option>)}</select>
        <select className={filterClass} value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">Tất cả nhóm chi</option>{expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
        <input className={filterClass} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm nội dung chi, nhóm chi, ghi chú..." />
        <button onClick={() => setEditing("new")} className="rounded-xl bg-rose-500 px-4 py-3 text-sm font-bold text-white">Thêm khoản chi</button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><p className="text-xs text-slate-400">{"Tổng chi năm"}</p><b className="font-semibold text-rose-500">{money(totalYear)}</b></Card>
        <Card><p className="text-xs text-slate-400">{"Tổng chi tháng"} {selectedMonth}</p><b className="font-semibold text-slate-900 dark:text-slate-100">{money(totalMonth)}</b></Card>
        <Card><p className="text-xs text-slate-400">{categoryFilter === "all" ? "Số nhóm có khoản chi" : \`Chi nhóm \${categoryFilter}\`}</p><b className="font-semibold text-slate-900 dark:text-slate-100">{categoryFilter === "all" ? activeCategoriesCount : money(categoryTotalForFilter)}</b></Card>
        <Card><p className="text-xs text-slate-400">{"Khoản chi lớn nhất"}</p><b className="font-semibold text-rose-500">{money(largest?.amount || 0)}</b></Card>
      </div>

      {viewTab === "list" && (
        <Card className="overflow-visible p-0">
          <div className="border-b border-[var(--app-border)] px-4 py-3"><b className="font-semibold text-slate-800 dark:text-slate-100">{"Danh sách theo tháng"}</b></div>
          <div className="divide-y divide-[var(--app-border)]">
          {monthSummaryRows.map(row => {
            const expanded = expandedIds.has(\`month-\${row.month}\`);
            return <div key={row.month} className="px-4 py-2.5">
              <button type="button" onClick={() => toggle(\`month-\${row.month}\`)} className="grid w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-white/5 sm:grid-cols-[1fr_120px_100px_32px]">
                <b className="font-semibold text-slate-800 dark:text-slate-100">{"Tháng"} {row.month}</b>
                <span className="font-bold text-rose-500 sm:text-right">{money(row.total)}</span>
                <span className="text-sm font-medium text-slate-500 sm:text-right">{row.count} {"khoản"}</span>
                <span className="grid size-8 place-items-center rounded-lg text-slate-500" aria-hidden><svg viewBox="0 0 24 24" className={\`size-4 fill-none stroke-current stroke-2 transition-transform \${expanded ? "rotate-180" : ""}\`} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></span>
              </button>
              {expanded && <div className="mt-1 divide-y divide-[var(--app-border)]">
                {row.items.map(record => {
                  const menuOpen = menuId === record.id;
                  return <div key={record.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-500">{formatDateVN(record.date)}{" · "}{record.category}</p>
                    <b className="mt-0.5 block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{record.title || "Khác"}</b>
                    {record.note && <p className="mt-0.5 truncate text-xs text-slate-500">{record.note}</p>}
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <b className="whitespace-nowrap text-sm font-semibold text-rose-500 sm:text-base">{money(record.amount)}</b>
                    <div className="relative">
                      <button type="button" onClick={() => setMenuId(menuOpen ? null : record.id)} className="grid size-9 place-items-center rounded-xl border border-[var(--app-border)] text-lg font-semibold text-slate-500">...</button>
                      {menuOpen && <div className="absolute right-0 top-10 z-30 w-36 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-1.5 shadow-xl">
                        <button className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => { setMenuId(null); setDetail(record); }}>Xem chi tiết</button>
                        <button className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => { setMenuId(null); setEditing(record); }}>Sửa</button>
                        <button className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-white/5" onClick={() => { setMenuId(null); setDeleting(record); }}>Xóa</button>
                      </div>}
                    </div>
                  </div>
                </div>;
                })}
              </div>}
            </div>;
          })}
          {!monthSummaryRows.length && <div className="p-6 text-center text-sm font-medium text-slate-500">{"Chưa có khoản chi."}</div>}
        </div>
      </Card>
      )}

      {viewTab === "chart" && (
        <div className="space-y-4">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <b>Tổng chi theo 12 tháng năm {year}</b>
            </div>
            <div className="flex h-56 items-end gap-2 overflow-x-auto pb-2">
              {monthlyTotals.map(item => (
                <div key={item.month} className="flex min-w-12 flex-1 flex-col items-center gap-2">
                  <div className="flex h-40 w-full items-end rounded-lg bg-slate-100 p-1 dark:bg-white/5">
                    <div className="w-full rounded-md bg-rose-500" style={{ height: \`\${Math.max(4, (item.total / maxMonth) * 100)}%\` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-400">{\`Tháng \${item.month}\`}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <b>Chi theo nhóm ({year})</b>
            {byCategory.length === 0 ? <p className="text-sm text-slate-500">Chưa có dữ liệu.</p> : (
              <div className="space-y-3">
                {byCategory.map(item => {
                  const percent = Math.round((item.total / (byCategory[0]?.total || 1)) * 100);
                  const displayPercent = totalYear > 0 ? ((item.total / totalYear) * 100).toFixed(1) + "%" : "0%";
                  return (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{item.label}</span>
                        <span className="text-slate-500">{money(item.total)} ({displayPercent})</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                        <div className="h-full rounded-full bg-rose-500" style={{ width: \`\${Math.max(2, percent)}%\` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {detail && <ExpenseDetail record={detail} close={() => setDetail(null)} />}
      {deleting && <ExpenseDeleteDialog record={deleting} close={() => setDeleting(null)} confirm={() => void remove(deleting)} />}
    </div>
  );
}

function ExpenseForm({ record, members, close, saved }: { record: Transaction | null; members: Member[]; close: () => void; saved: (record: Transaction) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState<ExpenseDraft>(() => ({ id: record?.id || crypto.randomUUID(), memberId: record?.memberId || members[0]?.id || "", date: record?.date || today, category: record?.category || "Khác", vendor: record?.title || "", totalAmount: String(record?.amount || ""), note: record?.note || "" }));
  const totalAmount = Number(String(draft.totalAmount).replace(/\\D/g, "") || 0);
  function patch(value: Partial<ExpenseDraft>) { setDraft(current => ({ ...current, ...value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const expense: Transaction = { id: draft.id, memberId: draft.memberId, date: draft.date, category: draft.category, title: draft.vendor.trim() || "Khác", amount: totalAmount, type: "expense", note: draft.note };
    const response = await fetch("/api/transactions", { method: record ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(expense) });
    if (!response.ok) return;
    const savedRecord = await response.json();
    savedRecord.amount = Number(savedRecord.amount);
    saved(savedRecord);
  }
  return <div className="space-y-5">
    <button type="button" onClick={close} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">{"← Quay lại bảng chi tiêu"}</button>
    <div><h2 className="text-2xl font-bold">{record ? "Sửa khoản chi" : "Thêm khoản chi"}</h2><p className="mt-1 text-sm text-slate-400">{"Mỗi khoản chi là một phiếu chi. Nhập nhanh chi tiết vào ghi chú nếu cần."}</p></div>
    <form onSubmit={submit} className="space-y-4">
      <Card><div className="grid gap-3 md:grid-cols-2">
        <Field label="Ngày chi"><DateVNInput required value={draft.date} onChange={value => patch({ date: value })} /></Field>
        <Field label="Nhóm chi"><select className={inputClass} value={draft.category} onChange={event => patch({ category: event.target.value })}>{expenseCategories.map(category => <option key={category}>{category}</option>)}</select></Field>
        <Field label="Nội dung chi"><input required className={inputClass} value={draft.vendor} onChange={event => patch({ vendor: event.target.value })} placeholder="Ví dụ: Đi chợ, Thanh toán tiền điện..." /></Field>
        <Field label="Tổng tiền"><input className={inputClass} value={draft.totalAmount} onChange={event => patch({ totalAmount: event.target.value.replace(/\\D/g, "") })} /></Field>
        <div className="md:col-span-2"><Field label="Ghi chú"><textarea rows={3} className={inputClass} value={draft.note} onChange={event => patch({ note: event.target.value })} placeholder="Coopmart: rau 30k, thịt 120k, sữa 70k" /></Field></div>
      </div></Card>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button><button className="rounded-xl bg-rose-500 px-6 py-3 text-sm font-bold text-white">Lưu phiếu chi</button></div>
    </form>
  </div>;
}

function ExpenseDetail({ record, close }: { record: Transaction; close: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/45 p-0 md:p-4" onMouseDown={close}><div onMouseDown={event => event.stopPropagation()} className="h-full w-full max-w-lg overflow-y-auto bg-[var(--app-card)] p-5 shadow-2xl md:rounded-2xl"><div className="flex items-center justify-between"><h3 className="text-lg font-bold">Chi tiết phiếu chi</h3><button onClick={close} className="grid size-9 place-items-center rounded-full border border-[var(--app-border)]">×</button></div><div className="mt-4 grid gap-3 text-sm"><AccountDetail label="Ngày chi" value={formatDateVN(record.date)} /><AccountDetail label="Nhóm chi" value={record.category} /><AccountDetail label="Nội dung chi" value={record.title || "Khác"} /><AccountDetail label="Tổng tiền" value={money(record.amount)} /><div className="rounded-xl border border-[var(--app-border)] p-4"><p className="text-xs font-bold uppercase text-slate-400">Ghi chú</p><p className="mt-1 font-semibold">{record.note || "Không có"}</p></div></div></div></div>;
}

function ExpenseDeleteDialog({ record, close, confirm }: { record: Transaction; close: () => void; confirm: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onMouseDown={close}><div onMouseDown={event => event.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[var(--app-card)] p-5 shadow-2xl"><h3 className="text-lg font-bold">Xóa phiếu chi này?</h3><div className="mt-4 rounded-xl border border-[var(--app-border)] p-4"><b>{record.title}</b><p className="mt-1 text-sm font-bold text-rose-500">{money(record.amount)}</p></div><div className="mt-5 flex justify-end gap-3"><button onClick={close} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">Hủy</button><button onClick={confirm} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white">Xóa</button></div></div></div>;
}
\n`;

const finalContent = c.substring(0, s) + newExpenseCode + c.substring(e);
fs.writeFileSync(file, finalContent, 'utf8');
console.log("Successfully wrote the fixed code.");
