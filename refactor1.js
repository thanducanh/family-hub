const fs = require('fs');

let content = fs.readFileSync('src/components/family-app.tsx', 'utf8');

const incomeFormStart = content.indexOf('function IncomeRecordForm(');
const incomeFormEnd = content.indexOf('function CategoryTotals(', incomeFormStart);

const newIncomeForm = `function IncomeRecordForm({ record, members: initialMembers, templates, user, back, saved, fixedJobId, fixedMemberId }: { record: IncomeRecord | null; members: { id: string; name: string }[]; templates: string[]; user?: AuthUser; back: () => void; saved: () => void; fixedJobId?: string; fixedMemberId?: string }) {
  const today = new Date(new Date().getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const emptyRow = (): IncomeDraft => ({ memberId: fixedMemberId || user?.memberId || initialMembers[0]?.id || "", jobId: fixedJobId || "", incomeDate: today, category: "Lương", name: "Lương CB", amount: "", status: "Đã nhận", note: "" });
  const [draft, setDraft] = useState<IncomeDraft>(() => record ? { id: record.id, memberId: record.memberId || fixedMemberId || user?.memberId || initialMembers[0]?.id || "", jobId: record.jobId || record.workId || fixedJobId || "", incomeDate: record.incomeDate || record.receivedDate || today, category: record.category, name: record.name, amount: String(record.amount), status: record.status, note: record.note } : emptyRow());
  const [otherMember, setOtherMember] = useState(() => record ? record.memberId !== user?.memberId && !fixedMemberId : false);
  
  const userRole = String(user?.role || "");
  const isAdmin = userRole === "full_access" || userRole === "system_admin" || userRole === "admin";
  const currentMemberId = user?.memberId || "";
  const effectiveMemberId = fixedMemberId || ((isAdmin && otherMember) ? draft.memberId : currentMemberId);
  
  const [apiMembers, setApiMembers] = useState<{ id: string; name: string }[]>(initialMembers);
  useEffect(() => {
    let active = true;
    if (isAdmin && otherMember && !fixedMemberId) {
      fetch("/api/members").then(res => res.json()).then(data => {
        if (active && data.ok && Array.isArray(data.data)) setApiMembers(data.data);
      });
    }
    return () => { active = false; };
  }, [isAdmin, otherMember, fixedMemberId]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof IncomeDraft>(key: K, value: IncomeDraft[K]) => setDraft(current => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    
    // Đảm bảo gửi đúng memberId
    const submitDraft = { ...draft, memberId: effectiveMemberId };
    
    try {
      const response = await fetch(submitDraft.id ? \`/api/incomes?id=\${submitDraft.id}\` : "/api/incomes", {
        method: submitDraft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitDraft)
      });
      const data = await readJsonSafe<{ ok?: boolean; error?: string }>(response);
      if (!response.ok || !data?.ok) {
        setError(data?.error || "Không thể lưu thu nhập.");
      } else {
        saved();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const allowMemberSelect = isAdmin && !fixedMemberId;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center md:p-6" onMouseDown={back}>
      <form onSubmit={submit} onMouseDown={event => event.stopPropagation()} className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[var(--app-card)] shadow-2xl md:max-w-xl md:rounded-3xl">
        <div className="shrink-0 border-b border-[var(--app-border)] px-5 py-4">
          <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-300 md:hidden" />
          <h2 className="text-lg font-bold">{record ? "Sửa khoản thu" : "Thêm khoản thu"}</h2>
          <p className="mt-1 text-sm text-slate-400">Điền thông tin chi tiết.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-4">
            {allowMemberSelect && (
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--app-border)] p-4">
                <input type="checkbox" checked={otherMember} onChange={e => setOtherMember(e.target.checked)} className="size-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                <span className="text-sm font-semibold">Nhập cho thành viên khác</span>
              </label>
            )}
            
            {allowMemberSelect && otherMember && (
              <Field label="Thành viên">
                <select className={inputClass} value={draft.memberId} onChange={e => set("memberId", e.target.value)} required>
                  <option value="" disabled>-- Chọn thành viên --</option>
                  {apiMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
            )}

            <Field label="Ngày nhận">
              <input type="date" required className={inputClass} value={draft.incomeDate} onChange={e => set("incomeDate", e.target.value)} />
            </Field>

            <Field label="Loại khoản thu">
              <select className={inputClass} value={draft.category} onChange={e => set("category", e.target.value as IncomeCategory)}>
                {incomeCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </Field>

            <Field label="Nội dung khoản thu">
              <input required className={inputClass} value={draft.name} onChange={e => set("name", e.target.value)} list="income-templates" />
              <datalist id="income-templates">{templates.map(t => <option key={t} value={t} />)}</datalist>
            </Field>

            <Field label="Số tiền">
              <input type="tel" inputMode="numeric" required className={inputClass} value={money(draft.amount)} onChange={e => set("amount", e.target.value.replace(/\\D/g, ""))} />
            </Field>
            
            <Field label="Trạng thái">
              <select className={inputClass} value={draft.status} onChange={e => set("status", e.target.value as IncomeStatus)}>
                {incomeStatuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </Field>

            <Field label="Ghi chú">
              <textarea rows={2} className={inputClass} value={draft.note} onChange={e => set("note", e.target.value)} />
            </Field>
          </div>
          {error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-500">{error}</p>}
        </div>
        <div className="flex shrink-0 gap-3 border-t border-[var(--app-border)] p-5">
          <button type="button" onClick={back} className="flex-1 rounded-xl bg-slate-100 py-3 font-bold text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">Hủy</button>
          <button type="submit" disabled={loading} className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{loading ? "Đang lưu..." : record ? "Cập nhật" : "Lưu thu nhập"}</button>
        </div>
      </form>
    </div>
  );
}
`;

content = content.substring(0, incomeFormStart) + newIncomeForm + content.substring(incomeFormEnd);

fs.writeFileSync('src/components/family-app.tsx', content);
console.log("Done refactoring IncomeRecordForm");
