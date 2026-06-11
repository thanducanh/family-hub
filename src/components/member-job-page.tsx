"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { IncomeRecord, Member, MemberJob, MemberJobStatus } from "@/types";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

const inputClass = "h-12 w-full rounded-lg border border-[var(--app-border)] bg-transparent px-3 text-sm outline-none focus:border-indigo-400";
const filterClass = "h-12 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm font-semibold outline-none";
const jobStatuses: { value: MemberJobStatus; label: string }[] = [{ value: "active", label: "Đang làm" }, { value: "ended", label: "Đã nghỉ" }];
const receivedStatus = "Đã nhận";
const moneyFormatter = new Intl.NumberFormat("vi-VN");

function money(value: number) {
  return `${moneyFormatter.format(Number.isFinite(value) ? value : 0)} đ`;
}

function recordJobId(record: IncomeRecord) {
  return record.jobId || record.workId || "";
}

function jobMonthTotal(job: MemberJob, records: IncomeRecord[], month: number) {
  return records.filter(record => recordJobId(record) === job.id && record.month === month && record.status === receivedStatus).reduce((sum, record) => sum + record.amount, 0);
}

function jobYearTotal(job: MemberJob, records: IncomeRecord[]) {
  return records.filter(record => recordJobId(record) === job.id && record.status === receivedStatus).reduce((sum, record) => sum + record.amount, 0);
}

function yearRange(job: MemberJob) {
  return `${job.startYear || "?"} - ${job.status === "active" ? "Nay" : job.endYear || "?"}`;
}

function normalizeYearInput(value: string) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300"><span className="mb-1.5 block">{label}</span>{children}</label>;
}

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

function emptyJob(memberId: string): MemberJob {
  return { id: "", memberId, title: "", company: "", startYear: new Date().getFullYear(), endYear: null, status: "active", note: "" };
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--app-border)] p-3"><p className="text-xs text-slate-400">{label}</p><b className="mt-1 block text-sm">{value}</b></div>;
}

export function MemberJobsPage({ memberId }: { memberId: string }) {
  const [member, setMember] = useState<Member | null>(null);
  const [jobs, setJobs] = useState<MemberJob[]>([]);
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<MemberJob | null>(null);
  const [deleting, setDeleting] = useState<MemberJob | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [memberResponse, jobsResponse, incomesResponse] = await Promise.all([
      fetch(`/api/members?id=${encodeURIComponent(memberId)}`, { cache: "no-store" }),
      fetch(`/api/member-jobs?memberId=${encodeURIComponent(memberId)}`, { cache: "no-store" }),
      fetch(`/api/incomes?year=${encodeURIComponent(year)}`, { cache: "no-store" }),
    ]);
    const memberResult = await readJsonSafe<{ ok?: boolean; data?: Member; error?: string }>(memberResponse);
    const jobsResult = await readJsonSafe<{ ok?: boolean; data?: MemberJob[]; error?: string }>(jobsResponse);
    const incomesResult = await readJsonSafe<{ ok?: boolean; data?: { allRecords?: IncomeRecord[] }; error?: string }>(incomesResponse);
    if (memberResponse.ok && memberResult?.data) setMember(memberResult.data);
    if (jobsResponse.ok && jobsResult?.ok) setJobs(jobsResult.data || []);
    else setError(jobsResult?.error || "Không thể tải công việc.");
    if (incomesResponse.ok && incomesResult?.data) setRecords((incomesResult.data.allRecords || []).filter(record => record.memberId === memberId));
    setLoading(false);
  }, [memberId, year]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  async function deleteJob(jobId: string) {
    await fetch(`/api/member-jobs?id=${encodeURIComponent(jobId)}`, { method: "DELETE" });
    setDeleting(null);
    void load();
  }
  const yearOptions = Array.from({ length: 9 }, (_, index) => String(new Date().getFullYear() - 4 + index));
  const totalYear = jobs.reduce((sum, job) => sum + jobYearTotal(job, records), 0);
  return <div className="max-w-6xl space-y-5">
    
    
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-2xl font-semibold">Công việc</h2><p className="mt-1 text-sm text-slate-400">{member?.nickname || member?.name || "Thành viên"} · Tổng thu nhập năm {year}: <b className="text-emerald-500">{money(totalYear)}</b></p></div>
      <div className="flex flex-wrap gap-2"><select className={filterClass} value={year} onChange={event => setYear(event.target.value)}>{yearOptions.map(value => <option key={value}>{value}</option>)}</select><button onClick={() => { window.location.href = `/members/${memberId}/jobs/new`; }} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">+ Thêm công việc</button></div>
    </div>
    {error && <p className="text-sm text-rose-500">{error}</p>}
    {viewing && <JobDetail job={viewing} records={records} year={year} close={() => setViewing(null)} edit={() => { window.location.href = `/members/${memberId}/jobs/${viewing.id}/edit`; }} />}
    {loading ? <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 text-center text-sm text-slate-400">Đang tải công việc...</div> : jobs.length ? <div className="space-y-3">{jobs.map(job => <div key={job.id} className="relative rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-5 shadow-sm"><div className="absolute bottom-5 left-8 top-5 w-px bg-slate-200 dark:bg-white/10" /><div className="relative flex gap-4"><span className="mt-1 size-3 shrink-0 rounded-full bg-indigo-500 ring-4 ring-indigo-100 dark:ring-indigo-500/20" /><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase text-slate-400">{yearRange(job)}</p><h3 className="mt-1 text-base font-bold">{job.title}</h3><p className="mt-1 text-sm text-slate-500">{job.company}</p><div className="mt-3 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${job.status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/15" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{job.status === "active" ? "Đang làm" : "Đã nghỉ"}</span></div></div><div className="flex shrink-0 items-start gap-2"><DropdownMenu><DropdownMenuTrigger className="flex size-8 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/5 outline-none"><MoreVertical className="size-4 text-slate-500" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setViewing(job)}>Xem chi tiết</DropdownMenuItem><DropdownMenuItem onClick={() => { window.location.href = `/members/${memberId}/jobs/${job.id}/edit`; }}>Chỉnh sửa</DropdownMenuItem><DropdownMenuItem className="text-rose-600 font-semibold focus:bg-rose-50 focus:text-rose-600 dark:focus:bg-rose-500/10" onClick={() => setDeleting(job)}>Xóa công việc</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div></div>)}</div> : <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-8 text-center text-sm text-slate-400">Chưa có lịch sử công việc.</div>}
    
    {deleting && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"><div className="w-full max-w-sm rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-xl"><h3 className="text-lg font-bold">Xóa công việc</h3><p className="mt-2 text-sm text-slate-500">Bạn có chắc muốn xóa công việc này?</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setDeleting(null)} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">Hủy</button><button onClick={() => void deleteJob(deleting.id)} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white">Xóa</button></div></div></div>}
    
  </div>;
}

export function MemberJobFormPage({ memberId, jobId, mode }: { memberId: string; jobId?: string; mode: "new" | "edit" }) {
  const router = useRouter();
  const [form, setForm] = useState<MemberJob>(() => emptyJob(memberId));
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [error, setError] = useState("");
  const set = <K extends keyof MemberJob>(key: K, value: MemberJob[K]) => setForm(current => ({ ...current, [key]: value }));
  useEffect(() => {
    void fetch(`/api/members?id=${encodeURIComponent(memberId)}`, { cache: "no-store" }).then(async response => {
      const result = await readJsonSafe<{ data?: Member }>(response);
      if (response.ok && result?.data) setMember(result.data);
    });
    if (mode === "edit" && jobId) {
      void fetch(`/api/member-jobs?id=${encodeURIComponent(jobId)}`, { cache: "no-store" }).then(async response => {
        const result = await readJsonSafe<{ data?: MemberJob; error?: string }>(response);
        if (response.ok && result?.data) setForm(result.data);
        else setError(result?.error || "Không thể tải công việc.");
        setLoading(false);
      });
    }
  }, [jobId, memberId, mode]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (form.status === "ended" && !form.endYear) {
      return setError("Vui lòng chọn năm kết thúc.");
    }
    if (form.status === "ended" && form.startYear && form.endYear && form.endYear < form.startYear) {
      return setError("Năm kết thúc không được nhỏ hơn năm bắt đầu.");
    }
    const payload = { ...form, endYear: form.status === "active" ? null : form.endYear };
    const response = await fetch(form.id ? `/api/member-jobs?id=${encodeURIComponent(form.id)}` : "/api/member-jobs", { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await readJsonSafe<{ ok?: boolean; data?: MemberJob; error?: string }>(response);
    if (!response.ok || !result?.data) return setError(result?.error || "Không thể lưu công việc.");
    router.push(`/members/${memberId}/jobs`);
  }
  if (loading) return <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 text-center text-sm text-slate-400">Đang tải công việc...</div>;
  return <div className="max-w-6xl space-y-6">
    <button onClick={() => router.push(`/members/${memberId}/jobs`)} className="text-sm font-semibold text-indigo-600">← Hồ sơ thành viên</button>
    <div><h2 className="text-2xl font-semibold">{mode === "edit" ? "Sửa công việc" : "Thêm công việc"}</h2><p className="mt-1 text-sm text-slate-400">{member?.nickname || member?.name || "Thành viên"}</p></div>
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-5">
        <h3 className="text-sm font-bold text-indigo-600">Thông tin công việc</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Tên công việc"><input required className={inputClass} value={form.title} onChange={event => set("title", event.target.value)} /></Field>
          <Field label="Công ty / nơi làm"><input required className={inputClass} value={form.company} onChange={event => set("company", event.target.value)} /></Field>
          <Field label="Năm bắt đầu">
            <select required className={inputClass} value={form.startYear || ""} onChange={event => set("startYear", Number(event.target.value) || null)}>
              <option value="" disabled>Chọn năm</option>
              {Array.from({ length: new Date().getFullYear() - 1980 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <Field label="Trạng thái"><select className={inputClass} value={form.status} onChange={event => { const status = event.target.value as MemberJobStatus; setForm(current => ({ ...current, status, endYear: status === "active" ? null : current.endYear })); }}>{jobStatuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></Field>
          <Field label="Năm kết thúc">
            <select required={form.status === "ended"} disabled={form.status === "active"} className={inputClass} value={form.status === "active" ? "Nay" : (form.endYear || "")} onChange={event => set("endYear", Number(event.target.value) || null)}>
              {form.status === "active" ? <option value="Nay">Nay</option> : <option value="" disabled>Chọn năm</option>}
              {Array.from({ length: new Date().getFullYear() - 1980 + 1 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <div className="md:col-span-2 xl:col-span-3"><Field label="Ghi chú"><textarea rows={4} className={`${inputClass} h-auto py-3`} value={form.note} onChange={event => set("note", event.target.value)} /></Field></div>
        </div>
      </section>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <div className="flex justify-end gap-3 pb-8"><button type="button" onClick={() => router.push(`/members/${memberId}/jobs`)} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button><button className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white">Lưu công việc</button></div>
    </form>
  </div>;
}

function JobDetail({ job, records, year, close, edit }: { job: MemberJob; records: IncomeRecord[]; year: string; close: () => void; edit: () => void }) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm sm:p-4">
    <div className="flex w-full max-w-2xl flex-col bg-white shadow-2xl sm:rounded-2xl dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-4">
        <div><h3 className="text-lg font-bold">{job.title}</h3><p className="text-sm text-slate-500">{job.company}</p></div>
        <button onClick={close} className="grid size-8 place-items-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20">X</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Info label="Thời gian làm" value={yearRange(job)} />
          <Info label="Trạng thái" value={job.status === "active" ? "Đang làm" : "Đã nghỉ"} />
          <Info label="Tổng thu đã nhận" value={money(jobYearTotal(job, records))} />
          <div className="col-span-2 rounded-xl border border-[var(--app-border)] p-3 sm:col-span-4"><p className="text-xs text-slate-400">Ghi chú</p><p className="mt-1 text-sm">{job.note || "Không có"}</p></div>
        </div>
        <div className="mt-8">
          <h4 className="mb-4 text-base font-bold">Thống kê thu nhập năm {year}</h4>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {months.map(month => {
              const total = jobMonthTotal(job, records, month);
              return <div key={month} className="rounded-xl border border-[var(--app-border)] bg-slate-50 p-3 text-center dark:bg-white/5"><p className="text-xs font-semibold text-slate-500">Tháng {month}</p><b className={`mt-1 block text-sm ${total > 0 ? "text-emerald-500" : "text-slate-400"}`}>{money(total)}</b></div>;
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
}
