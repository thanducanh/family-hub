const fs = require('fs');
let c = fs.readFileSync('src/components/family-app.tsx', 'utf8');

const startStr = 'function IncomeRecordForm(';
const endStr = '\nfunction IncomeManagement() {';

const startIdx = c.indexOf(startStr);
const endIdx = c.indexOf(endStr, startIdx);

const newForm = `function IncomeRecordForm({ record, members: initialMembers, templates, user, back, saved }: { record: IncomeRecord | null; members: { id: string; name: string }[]; templates: string[]; user?: AuthUser; back: () => void; saved: () => void; }) {
  const today = new Date(new Date().getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const emptyRow = (): IncomeDraft => ({ memberId: user?.memberId || initialMembers[0]?.id || "", jobId: "", incomeDate: today, category: "Lương", name: "", amount: "", status: "Đã nhận", note: "" });
  const [draft, setDraft] = useState<IncomeDraft>(() => record ? { id: record.id, memberId: record.memberId || user?.memberId || initialMembers[0]?.id || "", jobId: record.jobId || record.workId || "", incomeDate: record.incomeDate || record.receivedDate || today, category: record.category || "Khác", name: record.name, amount: String(record.amount), status: record.status, note: record.note } : emptyRow());
  const [otherMember, setOtherMember] = useState(() => record ? record.memberId !== user?.memberId : false);
  
  const userRole = String(user?.role || "");
  const isAdmin = userRole === "full_access" || userRole === "system_admin" || userRole === "admin";
  const currentMemberId = user?.memberId || "";
  const effectiveMemberId = (isAdmin && otherMember) ? draft.memberId : currentMemberId;
  
  const [apiMembers, setApiMembers] = useState<{ id: string; name: string }[]>(initialMembers);
  const [apiJobs, setApiJobs] = useState<MemberJob[]>([]);

  useEffect(() => {
    let active = true;
    if (isAdmin && otherMember) {
      fetch("/api/members").then(res => res.json()).then(data => {
        if (active && data.ok && Array.isArray(data.data)) setApiMembers(data.data);
      });
    }
    return () => { active = false; };
  }, [isAdmin, otherMember]);

  useEffect(() => {
    let active = true;
    if (effectiveMemberId) {
      fetch(\`/api/member-jobs?memberId=\${effectiveMemberId}\`)
        .then(res => res.json())
        .then(data => {
          if (active && data.ok && Array.isArray(data.data)) {
            const activeJobs = data.data.filter((j: any) => j.status === "active" || j.id === draft.jobId);
            setApiJobs(activeJobs);
          }
        });
    } else {
      setApiJobs([]);
    }
    return () => { active = false; };
  }, [effectiveMemberId, draft.jobId]);

  function patch(value: Partial<IncomeDraft>) { setDraft(current => ({ ...current, ...value })); }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const rawAmount = String(draft.amount).replace(/\\D/g, "");
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) { alert("Vui lòng nhập số tiền hợp lệ."); return; }
    const contentText = draft.name.trim();
    if (!contentText) { alert("Vui lòng nhập nội dung khoản thu."); return; }
    if (!effectiveMemberId) { alert("Chưa xác định thành viên nhận thu nhập."); return; }
    
    const payload = { memberId: effectiveMemberId, jobId: draft.jobId || null, category: draft.category, name: contentText, content: contentText, amount, receivedDate: draft.incomeDate, note: draft.note.trim() || null };
    
    const response = await fetch(record ? \`/api/incomes?id=\${encodeURIComponent(record.id)}\` : "/api/incomes", { method: record ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(record ? payload : { rows: [payload] }) });
    const result = await readJsonSafe<{ error?: string; details?: string }>(response);
    if (!response.ok) {
      alert((result?.error || "Không thể lưu thu nhập.") + (result?.details ? \`\\nLỗi: \${result.details}\` : ""));
      return;
    }
    alert("Đã lưu thu nhập");
    saved();
  }

  const allowMemberSelect = isAdmin;
  const rawAmountStr = String(draft.amount).replace(/\\D/g, "");
  const amountPreview = rawAmountStr ? money(Number(rawAmountStr)) : "";

  return <div className="space-y-5"><button onClick={back} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">← Quay lại bảng thu nhập</button><div><h2 className="text-2xl font-bold">{record ? "Sửa khoản thu" : "Thêm thu nhập"}</h2><p className="mt-1 text-sm text-slate-400">Khoản thu sẽ được ghi nhận vào bảng thu nhập.</p></div><form onSubmit={submit} className="space-y-4"><Card><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
  {allowMemberSelect && (
    <div className="md:col-span-2 xl:col-span-4 mb-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <input type="checkbox" checked={otherMember} onChange={e => { setOtherMember(e.target.checked); patch({ memberId: e.target.checked ? "" : currentMemberId, jobId: "" }); }} className="rounded text-emerald-500 focus:ring-emerald-500" /> Nhập cho thành viên khác
      </label>
    </div>
  )}
  {allowMemberSelect && otherMember && (
    <Field label="Thành viên">
      <select required className={inputClass} value={draft.memberId} onChange={event => patch({ memberId: event.target.value, jobId: "" })}>
        <option value="" disabled>Chọn thành viên</option>
        {apiMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
    </Field>
  )}
  <div className="md:col-span-2">
    <Field label="Nguồn thu / Công việc">
      <select className={inputClass} value={draft.jobId || ""} onChange={e => patch({ jobId: e.target.value })}>
        <option value="">Khác (Nhập tùy chỉnh)</option>
        {apiJobs.map(job => <option key={job.id} value={job.id}>{job.title}{job.company ? \` · \${job.company}\` : ""}</option>)}
      </select>
    </Field>
  </div>
  <Field label="Ngày nhận"><DateVNInput required value={draft.incomeDate} onChange={value => patch({ incomeDate: value })} /></Field>
  <Field label="Loại khoản thu">
    <select className={inputClass} value={draft.category} onChange={event => patch({ category: event.target.value as IncomeCategory })}>
      {incomeCategories.map(category => <option key={category} value={category}>{category}</option>)}
    </select>
  </Field>
  <div className="md:col-span-2">
    <Field label="Nội dung khoản thu">
      <input required className={inputClass} value={draft.name} onChange={event => patch({ name: event.target.value })} placeholder="VD: Lương cơ bản, bán đồ, thưởng tết..." />
    </Field>
  </div>
  <div className="md:col-span-2">
    <Field label="Số tiền">
      <div className="relative">
        <input required type="text" inputMode="numeric" pattern="[0-9]*" className={inputClass} value={draft.amount} onChange={e => patch({ amount: e.target.value.replace(/\\D/g, "") })} placeholder="VD: 2280000" />
        {amountPreview && <p className="absolute -bottom-5 left-0 text-xs text-slate-400">? {amountPreview}</p>}
      </div>
    </Field>
  </div>
  <div className="md:col-span-4 mt-2">
    <Field label="Ghi chú">
      <input className={inputClass} value={draft.note} onChange={event => patch({ note: event.target.value })} />
    </Field>
  </div>
  </div></Card><datalist id="income-template-list">{Array.from(new Set([...incomeTemplates, ...templates])).map(name => <option key={name} value={name} />)}</datalist><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={back} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button><button className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white">Lưu</button></div></form></div>;
}`;

c = c.substring(0, startIdx) + newForm + c.substring(endIdx);
fs.writeFileSync('src/components/family-app.tsx', c);
console.log('Updated IncomeRecordForm');
