"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@/components/family-app";
import { useUI } from "@/components/ui-context";
import type { Member, MemberSim, MemberSimCarrier, MemberSimStatus, MemberSimType } from "@/types";

const simCarriers: MemberSimCarrier[] = ["Viettel", "MobiFone", "VinaPhone", "Vietnamobile", "Wintel", "Local", "Khác"];
const simTypes: { value: MemberSimType; label: string }[] = [{ value: "personal", label: "Cá nhân" }, { value: "work", label: "Công việc" }, { value: "data", label: "Data" }, { value: "esim", label: "eSIM" }, { value: "other", label: "Khác" }];
const simStatuses: { value: MemberSimStatus; label: string }[] = [{ value: "active", label: "Đang dùng" }, { value: "paused", label: "Tạm ngưng" }, { value: "cancelled", label: "Đã hủy" }];
const inputClass = "h-12 w-full min-w-0 max-w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-3 text-sm outline-none focus:border-indigo-400";

type MemberSimWithSnakeCase = MemberSim & {
  member_id?: string;
  phone_number?: string;
  sim_type?: MemberSimType;
  plan_name?: string;
  monthly_fee?: number | string | null;
  data_amount?: string | null;
  billing_cycle_day?: number | string | null;
  renewal_months?: number | string | null;
  renewal_date?: string | null;
  last_topup_date?: string | null;
  last_topup_amount?: number | string | null;
  sim_balance?: number | string | null;
  next_renewal_date?: string | null;
};

type MemberSimForm = {
  id: string;
  memberId: string;
  carrier: MemberSimCarrier | "";
  phoneNumber: string;
  simType: MemberSimType;
  planName: string;
  monthlyFee: string;
  dataAmount: string;
  billingCycleDay: string;
  renewalMonths: string;
  renewalDate: string;
  lastTopupDate: string;
  lastTopupDateText: string;
  lastTopupAmount: string;
  simBalance: string;
  nextRenewalDate: string;
  nextRenewalDateText: string;
  status: MemberSimStatus;
  note: string;
};

const toDateInputValue = (value: unknown) => value ? String(value).slice(0, 10) : "";
const toInputValue = (value: unknown) => value === undefined || value === null ? "" : String(value);

function emptySimForm(memberId = ""): MemberSimForm {
  return { id: "", memberId, carrier: "", phoneNumber: "", simType: "personal", planName: "", monthlyFee: "", dataAmount: "", billingCycleDay: "", renewalMonths: "1", renewalDate: "", lastTopupDate: "", lastTopupDateText: "", lastTopupAmount: "", simBalance: "", nextRenewalDate: "", nextRenewalDateText: "", status: "active", note: "" };
}

function normalizeSimForm(sim: MemberSimWithSnakeCase, fallbackMemberId: string): MemberSimForm {
  const lastTopupDate = toDateInputValue(sim.lastTopupDate || sim.last_topup_date);
  const lastTopupDateText = isoToDisplayDate(lastTopupDate);
  const billingCycleDay = toInputValue(sim.billingCycleDay ?? sim.billing_cycle_day);
  const renewalMonths = toInputValue(sim.renewalMonths ?? sim.renewal_months) || "1";
  const nextRenewalDate = toDateInputValue(sim.nextRenewalDate || sim.next_renewal_date) || calculateNextRenewalDate(lastTopupDate, renewalMonths);
  const nextRenewalDateText = isoToDisplayDate(nextRenewalDate);
  return {
    id: sim.id || "",
    memberId: sim.memberId || sim.member_id || fallbackMemberId || "",
    carrier: sim.carrier || "",
    phoneNumber: sim.phoneNumber || sim.phone_number || "",
    simType: sim.simType || sim.sim_type || "personal",
    planName: sim.planName || sim.plan_name || "",
    monthlyFee: toInputValue(sim.monthlyFee ?? sim.monthly_fee),
    dataAmount: sim.dataAmount || sim.data_amount || "",
    billingCycleDay,
    renewalMonths,
    renewalDate: nextRenewalDate || toDateInputValue(sim.renewalDate || sim.renewal_date),
    lastTopupDate,
    lastTopupDateText,
    lastTopupAmount: toInputValue(sim.lastTopupAmount ?? sim.last_topup_amount),
    simBalance: toInputValue(sim.simBalance ?? sim.sim_balance),
    nextRenewalDate,
    nextRenewalDateText,
    status: sim.status || "active",
    note: sim.note || "",
  };
}

function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "đ";
}

function formatDateVN(value: string) {
  return isoToDisplayDate(value);
}

const isoToDisplayDate = (iso: unknown) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

const displayDateToIso = (value: unknown) => {
  const [d, m, y] = String(value || "").split("/");
  if (!d || !m || !y) return null;
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isValidDisplayDate(value: string) {
  if (!value) return true;
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) return false;
  const iso = displayDateToIso(value);
  if (!iso) return false;
  const [year, month, day] = iso.split("-").map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(year, month, 0).getDate();
}

function readJsonSafe<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase text-slate-400">{label}</span>{children}</label>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 shadow-sm ${className}`}>{children}</div>;
}

const simTypeLabel = (value: string) => simTypes.find(item => item.value === value)?.label || "Khác";
const simStatusLabel = (value: string) => simStatuses.find(item => item.value === value)?.label || "Đang dùng";
const simLabel = (sim: Pick<MemberSim, "planName" | "carrier" | "phoneNumber">) => [sim.planName || sim.phoneNumber || "SIM/Data", sim.carrier].filter(Boolean).join(" / ");
function calculateNextRenewalDate(lastTopupDate: string, renewalMonths: string | number | null) {
  return addMonthsToDateOnly(lastTopupDate, renewalMonths);
}

function addMonthsToDateOnly(isoDate: string, months: string | number | null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const resultMonthIndex = (m - 1) + Number(months || 0);
  if (Number.isNaN(resultMonthIndex) || resultMonthIndex < 0) return "";
  const newYear = y + Math.floor(resultMonthIndex / 12);
  const newMonth = (resultMonthIndex % 12) + 1;
  const lastDay = new Date(newYear, newMonth, 0).getDate();
  const newDay = Math.min(d, lastDay);
  return `${newYear}-${String(newMonth).padStart(2, "0")}-${String(newDay).padStart(2, "0")}`;
}

function addDaysToDateOnly(isoDate: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function simRenewalStatus(sim: MemberSim) {
  const missing = Math.max(0, Number(sim.monthlyFee || 0) - Number(sim.simBalance || 0));
  if (sim.nextRenewalDate && [todayIso(), addDaysToDateOnly(todayIso(), 1)].includes(sim.nextRenewalDate)) return "Sắp đến hạn";
  return missing > 0 ? `Thiếu ${money(missing)}` : "Đủ gia hạn";
}

export function MemberSimsPanel({ member, members, user }: { member: Member; members: Member[]; user: AuthUser }) {
  const ui = useUI();
  const canEdit = user.role === "full_access" || user.memberId === member.id;
  const [sims, setSims] = useState<MemberSim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<MemberSim | "new" | null>(null);
  const [form, setForm] = useState<MemberSimForm>(() => emptySimForm(member.id));

  const load = useCallback(async (checkRenewals = false) => {
    setLoading(true);
    setError("");
    if (checkRenewals) await fetch("/api/member-sims/check-renewals", { method: "POST" }).catch(() => null);
    const response = await fetch(`/api/member-sims?memberId=${encodeURIComponent(member.id)}`, { cache: "no-store" });
    const result = await readJsonSafe<{ ok?: boolean; data?: MemberSim[]; error?: string }>(response);
    setLoading(false);
    if (!response.ok || !result?.ok) return setError(result?.error || "Không thể tải SIM/Data.");
    setSims(result.data || []);
  }, [member.id]);

  useEffect(() => { void load(true); }, [load]);
  function startEdit(value: MemberSim | "new") {
    setEditing(value);
    if (value === "new") return setForm(emptySimForm(member.id));
    setForm(normalizeSimForm(value as MemberSimWithSnakeCase, member.id));
  }

  function patch(value: Partial<MemberSimForm>) {
    setForm(current => {
      const next = { ...current, ...value };
      const topupIso = isValidDisplayDate(next.lastTopupDateText) ? displayDateToIso(next.lastTopupDateText) || "" : "";
      next.lastTopupDate = topupIso || "";
      next.nextRenewalDate = calculateNextRenewalDate(topupIso, next.renewalMonths);
      next.nextRenewalDateText = isoToDisplayDate(next.nextRenewalDate);
      next.renewalDate = next.nextRenewalDate;
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.lastTopupDateText && !isValidDisplayDate(form.lastTopupDateText)) return ui.toast("Ngày đóng tiền phải có dạng dd/mm/yyyy", "error");
    if (form.nextRenewalDateText && !isValidDisplayDate(form.nextRenewalDateText)) return ui.toast("Ngày gia hạn tiếp theo phải có dạng dd/mm/yyyy", "error");
    const lastTopupDate = displayDateToIso(form.lastTopupDateText);
    const calculatedNextRenewalDate = calculateNextRenewalDate(lastTopupDate || "", form.renewalMonths);
    const nextRenewalDate = displayDateToIso(form.nextRenewalDateText) || calculatedNextRenewalDate;
    const lastTopupAmount = Number(form.lastTopupAmount || 0);
    const simBalance = form.simBalance === "" && lastTopupAmount > 0 ? lastTopupAmount : Number(form.simBalance || 0);
    const payload = {
      ...form,
      carrier: form.carrier || "Viettel",
      monthlyFee: Number(form.monthlyFee || 0),
      billingCycleDay: form.billingCycleDay ? Number(form.billingCycleDay) : null,
      renewalMonths: Math.max(1, Number(form.renewalMonths || 1)),
      lastTopupDate,
      last_topup_date: lastTopupDate,
      lastTopupAmount,
      simBalance,
      renewalDate: nextRenewalDate,
      nextRenewalDate,
      next_renewal_date: nextRenewalDate,
      renewal_months: Math.max(1, Number(form.renewalMonths || 1)),
    };
    const method = form.id ? "PUT" : "POST";
    const url = form.id ? `/api/member-sims/${encodeURIComponent(form.id)}` : "/api/member-sims";
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await readJsonSafe<{ ok?: boolean; data?: MemberSim; error?: string }>(response);
    if (!response.ok || !result?.ok || !result.data) return ui.toast(result?.error || "Không thể lưu SIM/Data.", "error");
    setSims(current => [result.data!, ...current.filter(item => item.id !== result.data!.id)]);
    setEditing(null);
    ui.toast(form.id ? "Đã cập nhật SIM/Data" : "Đã thêm SIM/Data");
  }

  async function remove(sim: MemberSim) {
    if (!await ui.confirm("Xóa SIM/Data?", `Xóa SIM/Data ${simLabel(sim)}?`)) return;
    const response = await fetch(`/api/member-sims/${encodeURIComponent(sim.id)}`, { method: "DELETE" });
    const result = await readJsonSafe<{ ok?: boolean; error?: string }>(response);
    if (!response.ok || !result?.ok) return ui.toast(result?.error || "Không thể xóa SIM/Data.", "error");
    setSims(current => current.filter(item => item.id !== sim.id));
    ui.toast("Đã xóa SIM/Data");
  }


  if (editing) {
    return <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold">{editing === "new" ? "Thêm SIM/Data" : "Sửa SIM/Data"}</h3><p className="mt-1 text-sm text-slate-400">Quản lý gói cước, phí duy trì và ngày gia hạn.</p></div><button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">Quay lại</button></div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-600">{error}</div>}
      {(() => {
        const topupIso = isValidDisplayDate(form.lastTopupDateText) ? displayDateToIso(form.lastTopupDateText) || "" : "";
        const nextRenewalDate = calculateNextRenewalDate(topupIso, form.renewalMonths);
        const missing = Math.max(0, Number(form.monthlyFee || 0) - Number(form.simBalance || 0));
        return <Card className={`p-4 text-sm font-semibold ${missing > 0 ? "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-400/10" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10"}`}>
          {missing > 0 ? `Số dư SIM không đủ gia hạn. Cần nạp thêm ${money(missing)}.` : "Đủ tiền gia hạn kỳ tiếp theo."}
          {nextRenewalDate && <p className="mt-1 text-xs opacity-80">Ngày gia hạn tiếp theo: {formatDateVN(nextRenewalDate)}</p>}
        </Card>;
      })()}
      <Card className="p-5"><div className="grid gap-4 md:grid-cols-2">
        <Field label="Thành viên sở hữu"><select className={inputClass} value={form.memberId || ""} disabled={!canEdit} onChange={event => patch({ memberId: event.target.value })}>{members.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Nhà mạng"><select className={inputClass} value={form.carrier || ""} onChange={event => patch({ carrier: event.target.value as MemberSimCarrier })}><option value="" disabled>Chọn nhà mạng</option>{simCarriers.map(value => <option key={value}>{value}</option>)}</select></Field>
        <Field label="Số điện thoại"><input className={inputClass} value={form.phoneNumber || ""} onChange={event => patch({ phoneNumber: event.target.value })} placeholder="09xx xxx xxx" /></Field>
        <Field label="Loại SIM"><select className={inputClass} value={form.simType || "personal"} onChange={event => patch({ simType: event.target.value as MemberSimType })}>{simTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
        <Field label="Tên gói cước"><input className={inputClass} value={form.planName || ""} onChange={event => patch({ planName: event.target.value })} placeholder="4G xe hơi" /></Field>
        <Field label="Phí gói hằng tháng"><input inputMode="numeric" className={inputClass} value={form.monthlyFee ?? ""} onChange={event => patch({ monthlyFee: event.target.value.replace(/\D/g, "") })} placeholder="0" /></Field>
        <Field label="Dung lượng data"><input className={inputClass} value={form.dataAmount || ""} onChange={event => patch({ dataAmount: event.target.value })} placeholder="VD: 8GB/ngày" /></Field>
        <Field label="Ngày đóng tiền"><input inputMode="numeric" placeholder="dd/mm/yyyy" className={inputClass} value={form.lastTopupDateText || ""} onChange={event => patch({ lastTopupDateText: event.target.value })} /></Field>
        <Field label="Số tháng gia hạn"><input type="number" min={1} className={inputClass} value={form.renewalMonths ?? ""} onChange={event => patch({ renewalMonths: event.target.value })} placeholder="1" /></Field>
        <Field label="Số tiền đã nạp vào SIM"><input inputMode="numeric" className={inputClass} value={form.lastTopupAmount ?? ""} onChange={event => { const amount = event.target.value.replace(/\D/g, ""); patch({ lastTopupAmount: amount, simBalance: form.simBalance === "" ? amount : form.simBalance }); }} placeholder="420000" /></Field>
        <Field label="Số dư SIM hiện tại"><input inputMode="numeric" className={inputClass} value={form.simBalance ?? ""} onChange={event => patch({ simBalance: event.target.value.replace(/\D/g, "") })} placeholder="420000" /></Field>
        <Field label="Ngày gia hạn tiếp theo"><input readOnly className={`${inputClass} bg-slate-50 text-slate-500 dark:bg-white/5`} value={form.nextRenewalDateText || "Tự tính sau khi nhập ngày đóng tiền và số tháng"} /></Field>
        <Field label="Trạng thái"><select className={inputClass} value={form.status || "active"} onChange={event => patch({ status: event.target.value as MemberSimStatus })}>{simStatuses.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
        <div className="md:col-span-2"><Field label="Ghi chú"><textarea rows={3} className={`${inputClass} h-auto py-3`} value={form.note || ""} onChange={event => patch({ note: event.target.value })} /></Field></div>
      </div></Card>
      <div className="flex justify-end gap-3"><button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button><button className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Lưu SIM/Data</button></div>
    </form>;
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">SIM / Data</h3><p className="mt-1 text-sm text-slate-400">{sims.length} SIM/Data đang quản lý</p></div><div className="flex flex-wrap gap-2">{canEdit && <button onClick={() => void load(true)} className="rounded-xl border border-[var(--app-border)] px-4 py-3 text-sm font-bold">Kiểm tra gia hạn</button>}{canEdit && <button onClick={() => startEdit("new")} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">+ Thêm SIM/Data</button>}</div></div>
    {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center"><p className="font-semibold text-rose-600">{error}</p><button onClick={() => void load()} className="mt-4 rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600">Làm mới</button></div> : loading ? <Card className="p-6 text-center text-slate-400">Đang tải SIM/Data...</Card> : sims.length ? <Card className="overflow-hidden p-0"><div className="hidden grid-cols-[1fr_1fr_1.2fr_120px_120px_130px_110px_76px] gap-4 border-b border-[var(--app-border)] bg-slate-50/70 px-5 py-3 text-xs font-bold uppercase text-slate-400 dark:bg-white/5 xl:grid"><span>Nhà mạng</span><span>Số SIM</span><span>Gói cước</span><span>Phí tháng</span><span>Số dư</span><span>Gia hạn tiếp theo</span><span>Trạng thái</span><span></span></div>{sims.map(sim => <div key={sim.id} className="grid gap-3 border-b border-[var(--app-border)] px-5 py-4 text-sm last:border-0 xl:grid-cols-[1fr_1fr_1.2fr_120px_120px_130px_110px_76px] xl:items-center"><div><b>{sim.carrier}</b><p className="mt-1 text-xs text-slate-400">{simTypeLabel(sim.simType)}</p></div><span className="font-semibold">{sim.phoneNumber || "Chưa cập nhật"}</span><div className="min-w-0"><b className="block truncate">{sim.planName || "Chưa đặt tên gói"}</b>{sim.dataAmount && <p className="mt-1 text-xs text-slate-400">{sim.dataAmount}</p>}</div><b className="text-indigo-600">{money(sim.monthlyFee || 0)}</b><b className={Number(sim.simBalance || 0) >= Number(sim.monthlyFee || 0) ? "text-emerald-600" : "text-rose-500"}>{money(sim.simBalance || 0)}</b><span>{isoToDisplayDate((sim as MemberSimWithSnakeCase).nextRenewalDate || (sim as MemberSimWithSnakeCase).next_renewal_date) || "Chưa có"}</span><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${sim.status === "active" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/15" : sim.status === "paused" ? "bg-amber-50 text-amber-600 dark:bg-amber-400/15" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{simStatusLabel(sim.status)}</span>{canEdit && <div className="flex gap-2 xl:justify-end"><button onClick={() => startEdit(sim)} className="rounded-lg px-2 py-1 text-xs font-bold text-indigo-600">Sửa</button><button onClick={() => void remove(sim)} className="rounded-lg px-2 py-1 text-xs font-bold text-rose-500">Xóa</button></div>}</div>)}</Card> : <Card className="p-8 text-center"><p className="font-semibold">Thành viên này chưa có SIM/Data.</p>{canEdit && <button onClick={() => startEdit("new")} className="mt-4 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">+ Thêm SIM/Data</button>}</Card>}
  </div>;
}
