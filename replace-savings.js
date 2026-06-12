const fs = require('fs');

const savingsSheetCode = `
function SavingsSheet() {
  const { toast, confirm } = useUI();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [yearStr, setYearStr] = useState(String(new Date().getFullYear()));
  const [holderFilter, setHolderFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<SavingsRecord | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(\`/api/savings-records\`, { cache: "no-store" });
    const result = await readJsonSafe<{ data?: any }>(response);
    if (response.ok && result?.data) setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const payload: any = data || {};
  const savingsRecords: SavingsRecord[] = Array.isArray(data)
    ? data
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.records)
        ? payload.records
        : [];

  const getAmount = (r: SavingsRecord) => r.type === "withdraw" ? -r.amount : r.amount;

  const holderRecords = savingsRecords.filter(r => holderFilter === "all" || r.holder === holderFilter);
  const totalAllTime = holderRecords.reduce((sum, r) => sum + getAmount(r), 0);
  const totalYear = holderRecords.filter(r => r.year === Number(yearStr)).reduce((sum, r) => sum + getAmount(r), 0);

  const filteredRecords = holderRecords.filter(r => r.year === Number(yearStr) && (!searchQuery || r.description.toLowerCase().includes(searchQuery.toLowerCase()) || r.note.toLowerCase().includes(searchQuery.toLowerCase())));
  const totalFiltered = filteredRecords.reduce((sum, r) => sum + getAmount(r), 0);

  function toggleMonth(month: number) {
    setExpandedMonths(current => {
      const next = new Set(current);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  async function handleDelete(id: string) {
    if (!await confirm("Xác nhận xóa", "Bạn có chắc muốn xóa khoản tiết kiệm này?")) return;
    const response = await fetch(\`/api/savings-records?id=\${id}\`, { method: "DELETE" });
    if (response.ok) {
      toast("Đã xóa khoản tiết kiệm", "success");
      load();
    } else {
      toast("Không thể xóa khoản tiết kiệm", "error");
    }
  }

  const typeLabels: Record<string, string> = {
    monthly: "Hàng tháng", extra: "Bất thường", bonus: "Thưởng", interest: "Lãi suất", withdraw: "Rút tiền", adjustment: "Điều chỉnh"
  };

  if (editing) {
    return <SavingsEditor item={editing} close={() => setEditing(null)} saved={() => { setEditing(null); load(); }} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <select className={filterClass} style={{ width: "130px" }} value={yearStr} onChange={event => setYearStr(event.target.value)}>
          {Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}
        </select>
        <select className={filterClass} value={holderFilter} onChange={e => setHolderFilter(e.target.value)}>
          <option value="all">Tất cả nơi giữ</option>
          <option value="Ngân hàng">Ngân hàng</option>
          <option value="Mẹ giữ">Mẹ giữ</option>
          <option value="Tiền mặt">Tiền mặt</option>
          <option value="Khác">Khác</option>
        </select>
        <div className="flex-1 min-w-[200px]">
          <input className={filterClass + " w-full"} placeholder="Tìm khoản tiết kiệm..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <button onClick={() => setEditing("new")} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white whitespace-nowrap">+ Thêm</button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card><p className="text-xs text-slate-400">Tiết kiệm hiện có</p><b className="text-emerald-500">{money(totalAllTime)}</b></Card>
        <Card><p className="text-xs text-slate-400">Tiết kiệm năm {yearStr}</p><b className="text-blue-500">{money(totalYear)}</b></Card>
        <Card><p className="text-xs text-slate-400">Khoản đang lọc</p><b className="text-indigo-500">{money(totalFiltered)}</b></Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--app-border)] p-4 bg-slate-50 dark:bg-white/5">
          <b>Danh sách tiết kiệm {yearStr}</b>
          {loading && <span className="text-xs text-slate-400">Đang tải...</span>}
        </div>
        <div className="divide-y divide-[var(--app-border)]">
          {Array.from({ length: 12 }, (_, i) => 12 - i).map(month => {
            const monthRecords = filteredRecords.filter(r => r.month === month);
            const monthTotal = monthRecords.reduce((sum, r) => sum + getAmount(r), 0);
            const expanded = expandedMonths.has(month);

            return (
              <div key={month} className="bg-[var(--app-card)]">
                <div className="flex cursor-pointer items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => toggleMonth(month)}>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">Tháng {month}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">{monthRecords.length} khoản</span>
                    <b className={monthTotal >= 0 ? "text-emerald-500" : "text-rose-500"}>{money(monthTotal)}</b>
                    <span className={\`text-slate-400 transition-transform \${expanded ? "rotate-180" : ""}\`}>▼</span>
                  </div>
                </div>
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
                        {monthRecords.map(item => (
                          <tr key={item.id} className="hover:bg-slate-100 dark:hover:bg-white/10">
                            <td className="px-4 py-3"><span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">{typeLabels[item.type] || item.type}</span></td>
                            <td className="px-4 py-3 font-semibold">{item.description} {item.note && <span className="ml-2 text-xs text-slate-400 font-normal">{item.note}</span>}</td>
                            <td className="px-4 py-3 text-slate-500">{item.holder}</td>
                            <td className={\`px-4 py-3 text-right font-bold \${item.type === "withdraw" ? "text-rose-500" : "text-emerald-500"}\`}>{money(getAmount(item))}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={(e) => { e.stopPropagation(); setEditing(item); }} className="mr-3 font-semibold text-blue-500 hover:text-blue-600">Sửa</button>
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="font-semibold text-rose-500 hover:text-rose-600">Xóa</button>
                            </td>
                          </tr>
                        ))}
                        {!monthRecords.length && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Không có khoản nào</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function SavingsEditor({ item, close, saved }: { item: SavingsRecord | "new"; close: () => void; saved: () => void }) {
  const { toast } = useUI();
  const existing = item !== "new" ? item : null;
  const today = new Date();
  
  const [form, setForm] = useState({
    year: existing?.year || today.getFullYear(),
    month: existing?.month || (today.getMonth() + 1),
    amount: existing ? String(existing.amount) : "",
    type: existing?.type || "monthly",
    holder: existing?.holder || "Ngân hàng",
    description: existing?.description || "",
    note: existing?.note || ""
  });

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) { setForm(c => ({ ...c, [key]: value })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, amount: Number(form.amount), id: existing?.id };
    const response = await fetch("/api/savings-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      toast(existing ? "Đã cập nhật thành công" : "Đã thêm khoản tiết kiệm", "success");
      saved();
    } else {
      toast("Lỗi khi lưu khoản tiết kiệm", "error");
    }
  }

  return (
    <div className="space-y-5">
      <button onClick={close} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">← Quay lại danh sách</button>
      <div>
        <h2 className="text-2xl font-bold">{existing ? "Sửa khoản tiết kiệm" : "Thêm khoản tiết kiệm"}</h2>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <Card className="grid gap-4 md:grid-cols-2">
          <Field label="Năm">
            <input required type="number" className={inputClass} value={form.year} onChange={e => set("year", Number(e.target.value))} />
          </Field>
          <Field label="Tháng">
            <select required className={inputClass} value={form.month} onChange={e => set("month", Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
            </select>
          </Field>
          <Field label="Loại">
            <select required className={inputClass} value={form.type} onChange={e => set("type", e.target.value)}>
              <option value="monthly">Hàng tháng</option>
              <option value="extra">Bất thường</option>
              <option value="bonus">Thưởng</option>
              <option value="interest">Lãi suất</option>
              <option value="withdraw">Rút tiền</option>
              <option value="adjustment">Điều chỉnh</option>
            </select>
          </Field>
          <Field label="Nơi giữ">
            <select required className={inputClass} value={form.holder} onChange={e => set("holder", e.target.value)}>
              <option value="Ngân hàng">Ngân hàng</option>
              <option value="Mẹ giữ">Mẹ giữ</option>
              <option value="Tiền mặt">Tiền mặt</option>
              <option value="Khác">Khác</option>
            </select>
          </Field>
          <Field label="Số tiền">
            <input required type="number" className={inputClass} value={form.amount} onChange={e => set("amount", e.target.value)} />
          </Field>
          <Field label="Nội dung">
            <input required className={inputClass} value={form.description} onChange={e => set("description", e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Ghi chú thêm (không bắt buộc)">
              <textarea rows={2} className={inputClass} value={form.note} onChange={e => set("note", e.target.value)} />
            </Field>
          </div>
        </Card>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={close} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button>
          <button type="submit" className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white">Lưu</button>
        </div>
      </form>
    </div>
  );
}
`;

let app = fs.readFileSync('src/components/family-app.tsx', 'utf8');

const savingsStart = app.indexOf('function SavingsSheet() {');
const savingsEnd = app.indexOf('type IncomeApiData = {', savingsStart);

if (savingsStart === -1 || savingsEnd === -1) {
  console.error("Could not find SavingsSheet");
  process.exit(1);
}

app = app.substring(0, savingsStart) + savingsSheetCode + '\\n' + app.substring(savingsEnd);

fs.writeFileSync('src/components/family-app.tsx', app, 'utf8');
console.log('Replaced SavingsSheet successfully');
