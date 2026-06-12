"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { AnnualFeeCycle, AnnualFeeWaiverType, BankAccount, BankAccountStatus, BankCardNetwork, BankCardReward, BankCardRewardType, BankCardType, BankExtractedCard, BankExtractedPayload, BankRawNote, Member } from "@/types";

type AuthUser = { id: string; username: string; displayName: string; avatar: string; role: "full_access" | "self_only"; memberId?: string };
type FormMode = "new" | "edit";

const bankNames = ["BIDV", "Vietcombank", "Techcombank", "MB", "VPBank", "ACB", "TPBank", "Sacombank", "VIB", "VietinBank", "Agribank", "UOB", "MoMo", "Apple Pay", "ZaloPay", "Khác"];
const bankCardTypes: BankCardType[] = ["Tài khoản ngân hàng", "Thẻ ghi nợ / ATM", "Thẻ tín dụng", "Ví điện tử"];
const bankNetworks: BankCardNetwork[] = ["Không áp dụng", "Napas", "Visa", "Mastercard", "JCB", "Amex", "Khác"];
const bankStatuses: BankAccountStatus[] = ["Đang dùng", "Tạm khóa", "Đã hủy"];
const waiverTypes: AnnualFeeWaiverType[] = ["Không có", "Theo tổng chi tiêu năm", "Theo tổng chi tiêu tháng", "Theo số giao dịch"];
const annualCycles: AnnualFeeCycle[] = ["tháng", "năm"];
const rewardTypes: BankCardRewardType[] = ["Hoàn tiền", "Đổi điểm thành tiền", "Quà tặng", "Miễn/giảm phí"];
type BankFormTab = "basic" | "card" | "fee" | "benefits" | "raw" | "notes";
const formTabs: { id: BankFormTab; label: string; short: string }[] = [
  { id: "basic", label: "Thông tin cơ bản", short: "Cơ bản" },
  { id: "card", label: "Thông tin thẻ", short: "Thẻ" },
  { id: "fee", label: "Phí thường niên", short: "Phí" },
  { id: "benefits", label: "Ưu đãi / Cashback", short: "Ưu đãi" },
  { id: "raw", label: "Nội dung gốc", short: "Nội dung" },
  { id: "notes", label: "Ghi chú", short: "Ghi chú" },
];
const inputClass = "w-full rounded-xl border border-[var(--app-border,#e2e8f0)] bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-indigo-500/20";
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(Number.isFinite(value) ? value : 0) + " ₫";

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

function newReward(): BankCardReward {
  return { id: crypto.randomUUID(), bankAccountId: "", rewardType: "Hoàn tiền", title: "", amount: 0, points: 0, recordedAt: new Date().toISOString().slice(0, 10), note: "" };
}

function emptyBankForm(memberId: string): BankAccount {
  return {
    id: crypto.randomUUID(), memberId, bankName: "BIDV", accountHolder: "", accountNumber: "", cardNumber: "",
    accountType: "Tài khoản ngân hàng", cardType: "Tài khoản ngân hàng", cardNetwork: "Không áp dụng", productName: "", branch: "",
    statementDay: "", dueDay: "", creditLimit: 0, expiryMonth: "", expiryYear: "", status: "Đang dùng",
    annualFeeEnabled: false, annualFeeAmount: 0, annualFeeWaiverType: "Không có", annualFeeWaiverTarget: 0, annualFeeCycle: "năm", annualFeeCycleStart: "", annualFeeCurrentSpending: 0, note: "", benefits: [], rewards: [],
  };
}

function isCreditType(type: BankCardType) {
  return type === "Thẻ tín dụng";
}


function maskDigits(value: string, card = false) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "Chưa cập nhật";
  const tail = digits.slice(-4);
  return card ? `**** **** **** ${tail}` : `******${tail}`;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block text-sm font-semibold text-slate-600 dark:text-slate-200"><span>{label}</span><div className="mt-2">{children}</div>{hint && <span className="mt-1 block text-xs font-medium text-slate-400">{hint}</span>}</label>;
}

function Shell({ member, title, children }: { member?: Member; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 text-sm font-semibold text-slate-400">Family Hub / Thành viên / {member?.nickname || member?.name || "Thẻ ngân hàng"} / {title}</div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{member ? member.nickname || member.name : "Đang tải dữ liệu"}</p>
        </div>
        <button type="button" onClick={() => history.back()} className="rounded-xl border border-[var(--app-border,#e2e8f0)] bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-100">Quay lại</button>
      </div>
      {children}
    </div>
  );
}

function LoadingState() {
  return <div className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm dark:bg-slate-900">Đang tải...</div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-200">{message}</div>;
}

export function BankCardFormPage({ memberId, cardId, mode }: { memberId: string; cardId?: string; mode: FormMode }) {
  const [user, setUser] = useState<AuthUser | null>();
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState<BankAccount>(() => emptyBankForm(memberId));
  const [activeTab, setActiveTab] = useState<BankFormTab>("basic");
  const [rawDraft, setRawDraft] = useState("");
  const [rawTitle, setRawTitle] = useState("Nội dung gốc ngân hàng");
  const [rawBankName, setRawBankName] = useState("BIDV");
  const [rawImageUrl, setRawImageUrl] = useState("");
  const [extracted, setExtracted] = useState<BankExtractedPayload | null>(null);
  const [selectedExtracted, setSelectedExtracted] = useState<Record<string, boolean>>({});
  const [extracting, setExtracting] = useState(false);
  const [renewalReminder, setRenewalReminder] = useState(false);
  const [replaceReminder, setReplaceReminder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const promises: Promise<Response>[] = [
        fetch("/api/auth/me"),
        fetch("/api/members")
      ];
      if (mode === "edit" && cardId) {
        promises.push(fetch(`/api/bank-accounts?id=${cardId}`));
      }
      
      const [meResponse, membersResponse, cardResponse] = await Promise.all(promises);
      const me = await readJsonSafe<{ user?: AuthUser }>(meResponse);
      const memberJson = await membersResponse.json();
      
      if (!active) return;
      
      const nextMembers = (Array.isArray(memberJson) ? memberJson : (memberJson.data ?? [])) as Member[];
      const nextUser = meResponse.ok && me?.user ? me.user : null;
      setUser(nextUser);
      setMembers(nextMembers);
      
      if (mode === "edit" && cardId && cardResponse) {
        const cardPayload = await readJsonSafe<{ ok?: boolean; data?: BankAccount }>(cardResponse);
        const found = cardPayload?.data;
        setForm(found ? { ...emptyBankForm(found.memberId), ...found, rewards: found.rewards || [] } : emptyBankForm(memberId));
      } else {
        const owner = nextMembers.find(member => member.id === memberId);
        setForm({ ...emptyBankForm(memberId), accountHolder: owner?.name || owner?.nickname || "" });
      }
      setLoading(false);
    }
    void load().catch(() => { if (active) { setError("Không tải được dữ liệu thẻ ngân hàng."); setLoading(false); } });
    return () => { active = false; };
  }, [cardId, memberId, mode]);

  const currentMember = members.find(member => member.id === form.memberId) || members.find(member => member.id === memberId);
  const canEdit = user?.role === "full_access" || Boolean(user?.memberId && user.memberId === form.memberId);
  const editableMembers = user?.role === "full_access" ? members : members.filter(member => member.id === user?.memberId);
  const credit = isCreditType(form.cardType);

  function set<K extends keyof BankAccount>(key: K, value: BankAccount[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function setReward(index: number, patch: Partial<BankCardReward>) {
    setForm(current => ({ ...current, rewards: current.rewards.map((reward, itemIndex) => itemIndex === index ? { ...reward, ...patch } : reward) }));
  }

  function setExtractedCard(index: number, patch: Partial<BankExtractedCard>) {
    setExtracted(current => current ? { ...current, cards: current.cards.map((card, itemIndex) => itemIndex === index ? { ...card, ...patch } : card) } : current);
  }

  function applyExtractedCard(card: BankExtractedCard) {
    setForm(current => ({
      ...current,
      bankName: extracted?.bank_name || current.bankName,
      productName: card.product_name,
      cardNetwork: card.card_network,
      cardType: card.card_type,
      accountType: card.card_type,
      annualFeeEnabled: card.annual_fee_amount > 0,
      annualFeeAmount: card.annual_fee_amount,
      annualFeeWaiverTarget: card.annual_fee_waiver_target,
      rewards: card.cashback_rules.map(rule => ({
        id: crypto.randomUUID(),
        bankAccountId: current.id,
        rewardType: "Hoàn tiền",
        title: `${card.product_name} - ${rule.category}`,
        amount: 0,
        points: 0,
        recordedAt: new Date().toISOString().slice(0, 10),
        note: `${rule.benefit_value}% · ${rule.condition_note}`,
      })),
      note: [current.note, card.raw_note, card.interest_rate ? `Lãi suất: ${card.interest_rate}` : "", card.foreign_transaction_fee ? `Phí giao dịch nước ngoài: ${card.foreign_transaction_fee}` : ""].filter(Boolean).join("\n"),
    }));
    setActiveTab("benefits");
  }

  async function extractRawInfo() {
    setExtracting(true);
    setError("");
    const payload = extractBankInfo(rawDraft, rawBankName, Boolean(rawImageUrl));
    setExtracted(payload);
    setSelectedExtracted(Object.fromEntries(payload.cards.map((_, index) => [String(index), index === 0])));
    await fetch("/api/bank-raw-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: form.memberId,
        bankAccountId: form.id,
        title: rawTitle || "Nội dung gốc ngân hàng",
        bankName: rawBankName,
        contentType: "Ưu đãi",
        rawText: rawDraft,
        imageUrl: rawImageUrl,
        extractedJson: payload,
        note: "Dữ liệu trích xuất tự động, vui lòng kiểm tra lại với thông tin chính thức từ ngân hàng.",
      }),
    }).catch(() => undefined);
    setExtracting(false);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    if (saving) return;
    setSaving(true);
    try {
      setError("");
      const response = await fetch(mode === "new" ? "/api/bank-accounts" : `/api/bank-accounts/${form.id}`, {
        method: mode === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, accountType: form.cardType }),
      });
      const result = await readJsonSafe<{ error?: string; data?: BankAccount }>(response);
      if (!response.ok || !result?.data) {
        setError(result?.error || "Không lưu được thẻ ngân hàng.");
        return;
      }
      window.location.href = `/members/${result.data.memberId}/bank-cards/${result.data.id}`;
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Shell title={mode === "new" ? "Thêm thẻ ngân hàng" : "Sửa thẻ ngân hàng"} member={currentMember}><LoadingState /></Shell>;
  if (!user) return <Shell title="Thẻ ngân hàng" member={currentMember}><ErrorState message="Bạn cần đăng nhập để xem trang này." /></Shell>;
  if (!canEdit) return <Shell title="Thẻ ngân hàng" member={currentMember}><ErrorState message="Không có quyền chỉnh sửa thẻ ngân hàng của thành viên này." /></Shell>;

  return (
    <Shell title={mode === "new" ? "Thêm thẻ ngân hàng" : "Sửa thẻ ngân hàng"} member={currentMember}>
      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white p-3 shadow-sm dark:bg-slate-900 lg:sticky lg:top-6 lg:h-fit">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {formTabs.map(tab => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`shrink-0 rounded-xl px-4 py-3 text-left text-sm font-bold transition lg:block lg:w-full ${activeTab === tab.id ? "bg-[#EEF2FF] text-[#4F46E5]" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5"}`}><span className="hidden lg:inline">● {tab.label}</span><span className="lg:hidden">{tab.short}</span></button>)}
          </div>
        </aside>
        <div className="min-w-0 rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white shadow-sm dark:bg-slate-900">
          <div className="min-h-[520px] space-y-6 p-5 sm:p-6">
            <p className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 dark:bg-orange-400/10 dark:text-orange-200">Thông tin ngân hàng là dữ liệu nhạy cảm.</p>
            {activeTab === "basic" && <section>
              <h2 className="text-lg font-bold">Thông tin cơ bản</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Thành viên sở hữu"><select required className={inputClass} value={form.memberId} onChange={event => set("memberId", event.target.value)}>{editableMembers.map(member => <option key={member.id} value={member.id}>{member.nickname || member.name}</option>)}</select></Field>
                <Field label="Ngân hàng"><select required className={inputClass} value={form.bankName} onChange={event => set("bankName", event.target.value)}>{bankNames.map(name => <option key={name}>{name}</option>)}</select></Field>
                <Field label="Chủ thẻ"><input required className={inputClass} value={form.accountHolder} onChange={event => set("accountHolder", event.target.value)} /></Field>
                <Field label="Loại thẻ"><select className={inputClass} value={form.cardType} onChange={event => { const value = event.target.value as BankCardType; setForm(current => ({ ...current, cardType: value, accountType: value, cardNetwork: value === "Thẻ tín dụng" && current.cardNetwork === "Không áp dụng" ? "Visa" : current.cardNetwork })); }}>{bankCardTypes.map(type => <option key={type}>{type}</option>)}</select></Field>
              </div>
              <div className="mt-6 flex justify-end"><button type="button" onClick={() => setActiveTab("card")} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Tiếp tục →</button></div>
            </section>}
            {activeTab === "card" && <section>
              <h2 className="text-lg font-bold">Thông tin thẻ</h2>
              {credit && <p className="mt-3 rounded-xl bg-[#EEF2FF] px-4 py-3 text-sm font-semibold text-[#4F46E5]">Thẻ tín dụng thường không có số tài khoản riêng. Bạn chỉ cần nhập số thẻ, hạn mức, ngày sao kê và ngày đến hạn.</p>}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {!credit && <Field label="Số tài khoản"><input className={inputClass} value={form.accountNumber} onChange={event => set("accountNumber", event.target.value)} /></Field>}
                {!credit && <Field label="Chi nhánh"><input className={inputClass} value={form.branch} onChange={event => set("branch", event.target.value)} /></Field>}
                {!credit && <Field label="Chủ tài khoản"><input className={inputClass} value={form.accountHolder} onChange={event => set("accountHolder", event.target.value)} /></Field>}
                <Field label="Số thẻ"><input className={inputClass} value={form.cardNumber} onChange={event => set("cardNumber", event.target.value)} /></Field>
                {credit && <Field label="Tên sản phẩm"><input className={inputClass} value={form.productName} onChange={event => set("productName", event.target.value)} placeholder="BIDV Visa Platinum Cashback 360" /></Field>}
                {credit && <Field label="Tổ chức thẻ"><select className={inputClass} value={form.cardNetwork} onChange={event => set("cardNetwork", event.target.value as BankCardNetwork)}>{bankNetworks.map(value => <option key={value}>{value}</option>)}</select></Field>}
                {credit && <Field label="Hạn mức tín dụng"><input className={inputClass} type="number" min="0" value={form.creditLimit} onChange={event => set("creditLimit", Number(event.target.value))} /></Field>}
                {credit && <Field label="Ngày sao kê"><input className={inputClass} inputMode="numeric" value={form.statementDay} onChange={event => set("statementDay", event.target.value)} /></Field>}
                {credit && <Field label="Ngày đến hạn thanh toán"><input className={inputClass} inputMode="numeric" value={form.dueDay} onChange={event => set("dueDay", event.target.value)} /></Field>}
                {credit && <div className="grid grid-cols-2 gap-2"><Field label="Tháng hết hạn"><input className={inputClass} inputMode="numeric" maxLength={2} value={form.expiryMonth} onChange={event => set("expiryMonth", event.target.value)} /></Field><Field label="Năm hết hạn"><input className={inputClass} inputMode="numeric" maxLength={4} value={form.expiryYear} onChange={event => set("expiryYear", event.target.value)} /></Field></div>}
                <Field label="Trạng thái"><select className={inputClass} value={form.status} onChange={event => set("status", event.target.value as BankAccountStatus)}>{bankStatuses.map(status => <option key={status}>{status}</option>)}</select></Field>
              </div>
            </section>}
            {activeTab === "fee" && <section>
              <h2 className="text-lg font-bold">Phí thường niên</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--app-border,#e2e8f0)] px-4 text-sm font-bold"><input type="checkbox" checked={form.annualFeeEnabled} onChange={event => set("annualFeeEnabled", event.target.checked)} /> Có phí thường niên</label>
                <Field label="Số tiền phí thường niên"><input className={inputClass} type="number" min="0" value={form.annualFeeAmount} onChange={event => set("annualFeeAmount", Number(event.target.value))} /></Field>
                <Field label="Điều kiện miễn phí"><select className={inputClass} value={form.annualFeeWaiverType} onChange={event => set("annualFeeWaiverType", event.target.value as AnnualFeeWaiverType)}>{waiverTypes.map(value => <option key={value}>{value}</option>)}</select></Field>
                <Field label="Mức chi tiêu cần đạt"><input className={inputClass} type="number" min="0" value={form.annualFeeWaiverTarget} onChange={event => set("annualFeeWaiverTarget", Number(event.target.value))} /></Field>
                <Field label="Đã chi trong chu kỳ"><input className={inputClass} type="number" min="0" value={form.annualFeeCurrentSpending} onChange={event => set("annualFeeCurrentSpending", Number(event.target.value))} /></Field>
                <Field label="Chu kỳ tính"><select className={inputClass} value={form.annualFeeCycle} onChange={event => set("annualFeeCycle", event.target.value as AnnualFeeCycle)}>{annualCycles.map(value => <option key={value}>{value}</option>)}</select></Field>
                <Field label="Ngày bắt đầu chu kỳ"><input className={inputClass} type="date" value={form.annualFeeCycleStart} onChange={event => set("annualFeeCycleStart", event.target.value)} /></Field>
              </div>
              <p className={`mt-5 rounded-xl px-4 py-3 text-sm font-bold ${Math.max(0, form.annualFeeWaiverTarget - form.annualFeeCurrentSpending) > 0 ? "bg-orange-50 text-orange-600 dark:bg-orange-400/10 dark:text-orange-200" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-200"}`}>{Math.max(0, form.annualFeeWaiverTarget - form.annualFeeCurrentSpending) > 0 ? `⚠ Còn thiếu ${money(Math.max(0, form.annualFeeWaiverTarget - form.annualFeeCurrentSpending))} để được miễn phí` : "✓ Đã đạt điều kiện"}</p>
            </section>}
            {activeTab === "benefits" && <section>
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Hoàn tiền / điểm thưởng</h2><button type="button" onClick={() => setForm(current => ({ ...current, rewards: [...current.rewards, newReward()] }))} className="rounded-xl border border-indigo-200 bg-[#EEF2FF] px-4 py-3 text-sm font-bold text-[#4F46E5]">+ Thêm ghi nhận</button></div>
              <div className="mt-4 space-y-4">
                {form.rewards.length ? form.rewards.map((reward, index) => (
                  <div key={reward.id} className="rounded-2xl border border-[var(--app-border,#e2e8f0)] p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">{reward.title || reward.rewardType}</p><p className="mt-1 text-sm font-semibold text-slate-500">{reward.rewardType} · {money(reward.amount)} · {reward.points ? `${reward.points} điểm` : "Không có điểm"}</p></div></div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Loại ghi nhận"><select className={inputClass} value={reward.rewardType} onChange={event => setReward(index, { rewardType: event.target.value as BankCardRewardType })}>{rewardTypes.map(value => <option key={value}>{value}</option>)}</select></Field>
                      <Field label="Tiêu đề"><input className={inputClass} value={reward.title} onChange={event => setReward(index, { title: event.target.value })} /></Field>
                      <Field label="Số tiền"><input className={inputClass} type="number" min="0" value={reward.amount} onChange={event => setReward(index, { amount: Number(event.target.value) })} /></Field>
                      <Field label="Điểm thưởng"><input className={inputClass} type="number" min="0" value={reward.points} onChange={event => setReward(index, { points: Number(event.target.value) })} /></Field>
                      <Field label="Ngày ghi nhận"><input className={inputClass} type="date" value={reward.recordedAt} onChange={event => setReward(index, { recordedAt: event.target.value })} /></Field>
                    </div>
                    <div className="mt-4"><Field label="Ghi chú"><textarea rows={2} className={inputClass} value={reward.note} onChange={event => setReward(index, { note: event.target.value })} /></Field></div>
                    <div className="mt-4 flex justify-end"><button type="button" onClick={() => setForm(current => ({ ...current, rewards: current.rewards.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-xl px-4 py-2 text-sm font-bold text-rose-500 hover:bg-rose-50">Xóa ghi nhận</button></div>
                  </div>
                )) : <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 dark:bg-white/5">Chưa có hoàn tiền/điểm thưởng ghi nhận.</p>}
              </div>
            </section>}
            {activeTab === "raw" && <section>
              <h2 className="text-lg font-bold">Nội dung gốc</h2>
              <p className="mt-2 text-sm font-semibold text-slate-400">Upload ảnh bảng phí/ưu đãi hoặc dán điều khoản, email, PDF copy text, website ngân hàng để trích xuất dữ liệu thẻ.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Tiêu đề nội dung"><input className={inputClass} value={rawTitle} onChange={event => setRawTitle(event.target.value)} /></Field>
                <Field label="Chọn ngân hàng"><select className={inputClass} value={rawBankName} onChange={event => setRawBankName(event.target.value)}>{bankNames.map(name => <option key={name}>{name}</option>)}</select></Field>
                <Field label="Thẻ liên quan nếu có"><select className={inputClass} value={form.id} disabled><option>{form.productName || form.bankName || "Thẻ hiện tại"}</option></select></Field>
                <Field label="Upload ảnh"><input className={inputClass} type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setRawImageUrl(typeof reader.result === "string" ? reader.result : ""); reader.readAsDataURL(file); }} /></Field>
              </div>
              {rawImageUrl && <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--app-border,#e2e8f0)]"><Image unoptimized width={960} height={420} src={rawImageUrl} alt="Ảnh nội dung gốc ngân hàng" className="max-h-64 w-full object-contain bg-slate-50 dark:bg-white/5" /></div>}
              <Field label="Dán nội dung text"><textarea rows={10} className={`${inputClass} mt-4 font-mono leading-6`} value={rawDraft} onChange={event => setRawDraft(event.target.value)} placeholder="Dán nội dung gốc tại đây..." /></Field>
              <p className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 dark:bg-orange-400/10 dark:text-orange-200">Dữ liệu được trích xuất tự động, vui lòng kiểm tra lại với thông tin chính thức từ ngân hàng.</p>
              <button type="button" disabled={extracting || (!rawDraft.trim() && !rawImageUrl)} onClick={() => void extractRawInfo()} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{extracting ? "Đang trích xuất..." : "Trích xuất thông tin"}</button>
              {extracted && <div className="mt-6 rounded-2xl border border-[var(--app-border,#e2e8f0)] p-4">
                <h3 className="font-bold">Review dữ liệu trích xuất</h3>
                <div className="mt-4 space-y-4">{extracted.cards.map((card, index) => <div key={`${card.product_name}-${index}`} className="rounded-xl border border-[var(--app-border,#e2e8f0)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-3 font-bold"><input type="checkbox" checked={selectedExtracted[String(index)] || false} onChange={event => setSelectedExtracted(current => ({ ...current, [String(index)]: event.target.checked }))} /> {card.product_name}</label><span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-xs font-bold text-[#4F46E5]">{card.card_network}</span></div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2"><Field label="Tên sản phẩm"><input className={inputClass} value={card.product_name} onChange={event => setExtractedCard(index, { product_name: event.target.value })} /></Field><Field label="Loại thẻ"><select className={inputClass} value={card.card_type} onChange={event => setExtractedCard(index, { card_type: event.target.value as BankCardType })}>{bankCardTypes.map(type => <option key={type}>{type}</option>)}</select></Field><Field label="Phí thường niên"><input className={inputClass} type="number" value={card.annual_fee_amount} onChange={event => setExtractedCard(index, { annual_fee_amount: Number(event.target.value) })} /></Field><Field label="Doanh số miễn phí"><input className={inputClass} type="number" value={card.annual_fee_waiver_target} onChange={event => setExtractedCard(index, { annual_fee_waiver_target: Number(event.target.value) })} /></Field><Field label="Lãi suất"><input className={inputClass} value={card.interest_rate} onChange={event => setExtractedCard(index, { interest_rate: event.target.value })} /></Field><Field label="Phí giao dịch nước ngoài"><input className={inputClass} value={card.foreign_transaction_fee} onChange={event => setExtractedCard(index, { foreign_transaction_fee: event.target.value })} /></Field></div>
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5">{card.cashback_rules.map(rule => <p key={`${rule.category}-${rule.benefit_value}`}><b>{rule.category}</b>: {rule.benefit_value}% · {rule.condition_note}</p>)}</div>
                  <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => applyExtractedCard(card)} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">Áp dụng vào thẻ hiện tại</button><button type="button" onClick={() => { applyExtractedCard(card); window.setTimeout(() => { window.location.href = `/members/${form.memberId}/bank-cards/new`; }, 0); }} className="rounded-xl border border-indigo-200 px-4 py-3 text-sm font-bold text-indigo-600">Tạo thẻ mới từ dữ liệu này</button></div>
                </div>)}</div>
              </div>}
            </section>}
            {activeTab === "notes" && <section>
              <h2 className="text-lg font-bold">Ghi chú</h2>
              <div className="mt-4 space-y-4"><Field label="Ghi chú cá nhân"><textarea rows={6} className={inputClass} value={form.note} onChange={event => set("note", event.target.value)} /></Field><label className="flex items-center gap-3 rounded-xl border border-[var(--app-border,#e2e8f0)] px-4 py-3 text-sm font-bold"><input type="checkbox" checked={renewalReminder} onChange={event => setRenewalReminder(event.target.checked)} /> Nhắc gia hạn</label><label className="flex items-center gap-3 rounded-xl border border-[var(--app-border,#e2e8f0)] px-4 py-3 text-sm font-bold"><input type="checkbox" checked={replaceReminder} onChange={event => setReplaceReminder(event.target.checked)} /> Nhắc đổi thẻ</label></div>
            </section>}
            {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
          </div>
          <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-3 border-t border-[var(--app-border,#e2e8f0)] bg-white/95 p-4 backdrop-blur dark:bg-slate-900/95">
            <button type="button" onClick={() => history.back()} className="min-h-11 rounded-xl border border-[var(--app-border,#e2e8f0)] px-5 text-sm font-bold text-slate-600 dark:text-slate-100">Hủy</button>
            <button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white disabled:opacity-60">{saving ? "Đang lưu..." : "Lưu thẻ"}</button>
          </div>
        </div>
      </form>
    </Shell>
  );
}

export function BankCardDetailPage({ memberId, cardId }: { memberId: string; cardId: string }) {
  const [owner, setOwner] = useState<Member | null>(null);
  const [account, setAccount] = useState<BankAccount | null>(() => readPrefillCard(cardId));
  const [rawNotes, setRawNotes] = useState<BankRawNote[]>([]);
  const [rawNoteOpen, setRawNoteOpen] = useState<BankRawNote | null>(null);
  const [manualExtractOpen, setManualExtractOpen] = useState<BankRawNote | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [loading, setLoading] = useState(!account);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const ownerForShell = owner || undefined;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    async function load() {
      setLoading(true);
      setError("");
      const url = `/api/bank-accounts/${cardId}`;
      console.info("[BankCardDetail] fetch", { url, memberId, cardId });
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      const result = await readJsonSafe<{ ok?: boolean; error?: string; data?: BankAccount | { account: BankAccount | null; member: Member | null; rawNotes: BankRawNote[] } | null; member?: Member | null; rawNotes?: BankRawNote[] }>(response);
      if (!active) return;
      if (!response.ok || !result?.ok) {
        setError(result?.error || "Không tải được thông tin thẻ.");
        return;
      }
      const account = result.data && "account" in result.data ? result.data.account : result.data;
      const member = result.data && "account" in result.data ? result.data.member : result.member;
      const rawNotes = result.data && "account" in result.data ? result.data.rawNotes : result.rawNotes;
      if (!account) {
        setAccount(null);
        setError("Không tìm thấy thẻ ngân hàng.");
        return;
      }
      setAccount(account);
      setOwner(member || null);
      setRawNotes(rawNotes || []);
      if (account.memberId !== memberId) setError("Đường dẫn thành viên không khớp thẻ, đã tải theo mã thẻ.");
    }
    void load().catch(error => {
      if (!active) return;
      setError(error instanceof DOMException && error.name === "AbortError" ? "Tải dữ liệu quá lâu, vui lòng thử lại." : "Không tải được thông tin thẻ.");
    }).finally(() => {
      window.clearTimeout(timeout);
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [cardId, memberId, retryKey]);

  const annualFeeMissing = account ? Math.max(0, account.annualFeeWaiverTarget - account.annualFeeCurrentSpending) : 0;
  const progressText = account?.annualFeeEnabled && account.annualFeeWaiverTarget > 0 ? `Đã chi ${money(account.annualFeeCurrentSpending)} / ${money(account.annualFeeWaiverTarget)} để miễn phí thường niên` : "Không có điều kiện miễn phí";

  if (loading && !account) return <Shell title="Chi tiết thẻ ngân hàng" member={ownerForShell}><BankCardDetailSkeleton /></Shell>;
  if (error && !account) return <Shell title="Chi tiết thẻ ngân hàng" member={ownerForShell}><ErrorState message={error} /><button onClick={() => setRetryKey(current => current + 1)} className="mt-4 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">Thử lại</button></Shell>;
  if (!account) return <Shell title="Chi tiết thẻ ngân hàng" member={ownerForShell}><ErrorState message="Không tìm thấy thẻ ngân hàng." /><button onClick={() => setRetryKey(current => current + 1)} className="mt-4 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">Thử lại</button></Shell>;

  return (
    <Shell title="Chi tiết thẻ ngân hàng" member={ownerForShell}>
      {loading && <p className="mb-4 rounded-xl bg-[#EEF2FF] px-4 py-3 text-sm font-semibold text-[#4F46E5]">Đang cập nhật dữ liệu chi tiết...</p>}
      {error && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700"><span>{error}</span><button onClick={() => setRetryKey(current => current + 1)} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-orange-700">Thử lại</button></div>}
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white p-3 shadow-sm dark:bg-slate-900 lg:sticky lg:top-6 lg:h-fit">
          {["Thông tin thẻ", "Phí thường niên", "Hoàn tiền / điểm thưởng", "Nội dung gốc liên quan", "Giao dịch liên quan"].map((section, index) => <a key={section} href={`#detail-${index}`} className="block rounded-xl px-4 py-3 text-sm font-bold text-slate-500 hover:bg-[#EEF2FF] hover:text-[#4F46E5]">{section}</a>)}
        </aside>
        <div className="space-y-5">
          <section id="detail-0" className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white p-5 shadow-sm dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{account.productName || account.bankName}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{account.bankName} · {account.cardType} · {account.cardNetwork}</p></div><a href={`/members/${account.memberId}/bank-cards/${account.id}/edit`} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">Sửa thẻ</a></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Info label="Chủ thẻ / chủ tài khoản" value={account.accountHolder} />
              <Info label="Số tài khoản" value={showFull ? account.accountNumber || "Không có" : maskDigits(account.accountNumber)} />
              <Info label="Số thẻ" value={showFull ? account.cardNumber || "Không có" : maskDigits(account.cardNumber, true)} />
              <Info label="Chi nhánh" value={account.branch || "Không có"} />
              <Info label="Hạn mức" value={account.creditLimit ? money(account.creditLimit) : "Không có"} />
              <Info label="Ngày sao kê / đến hạn" value={`${account.statementDay || "-"} / ${account.dueDay || "-"}`} />
              <Info label="Hết hạn" value={account.expiryMonth || account.expiryYear ? `${account.expiryMonth}/${account.expiryYear}` : "Không có"} />
              <Info label="Trạng thái" value={account.status} />
            </div>
            <button type="button" onClick={() => setShowFull(current => !current)} className="mt-5 rounded-xl border border-[var(--app-border,#e2e8f0)] px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-100">{showFull ? "Ẩn số đầy đủ" : "Hiện số đầy đủ"}</button>
          </section>
          <section id="detail-1" className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white p-5 shadow-sm dark:bg-slate-900">
            <h2 className="text-lg font-bold">Phí thường niên</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><Info label="Có phí thường niên" value={account.annualFeeEnabled ? "Có" : "Không"} /><Info label="Số tiền" value={money(account.annualFeeAmount)} /><Info label="Điều kiện miễn phí" value={account.annualFeeWaiverType} /><Info label="Tiến độ" value={progressText} /><Info label="Còn thiếu" value={money(annualFeeMissing)} /></div>
          </section>
          <section id="detail-2" className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white p-5 shadow-sm dark:bg-slate-900">
            <h2 className="text-lg font-bold">Hoàn tiền / điểm thưởng đã ghi nhận</h2>
            <div className="mt-4 space-y-3">{account.rewards.length ? account.rewards.map(reward => <div key={reward.id} className="rounded-xl border border-[var(--app-border,#e2e8f0)] p-4"><p className="font-bold">{reward.title || reward.rewardType}</p><p className="mt-1 text-sm font-semibold text-slate-500">{reward.rewardType} · {money(reward.amount)} · {reward.points ? `${reward.points} điểm` : "Không có điểm"}</p><p className="mt-1 text-sm text-slate-400">{reward.recordedAt || "Chưa có ngày"} · {reward.note || "Không có ghi chú"}</p></div>) : <p className="text-sm font-semibold text-slate-500">Chưa có hoàn tiền/điểm thưởng ghi nhận.</p>}</div>
          </section>
          <section id="detail-3" className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white p-5 shadow-sm dark:bg-slate-900">
            <h2 className="text-lg font-bold">Nội dung gốc liên quan</h2>
            <div className="mt-4 space-y-3">{rawNotes.length ? rawNotes.map(note => <div key={note.id} className="rounded-xl border border-[var(--app-border,#e2e8f0)] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{note.title}</p><p className="mt-1 text-sm font-semibold text-slate-500">{note.bankName} · {note.contentType}</p><p className="mt-2 line-clamp-2 text-sm text-slate-400">{note.rawText}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setRawNoteOpen(note)} className="rounded-xl border border-indigo-100 bg-[#EEF2FF] px-3 py-2 text-xs font-bold text-[#4F46E5]">Xem nội dung</button><button onClick={() => setManualExtractOpen(note)} className="rounded-xl border border-[var(--app-border,#e2e8f0)] px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-100">Tạo ưu đãi từ nội dung này</button></div></div></div>) : <p className="text-sm font-semibold text-slate-500">Chưa có nội dung gốc liên quan đến thẻ này.</p>}</div>
          </section>
          <section id="detail-4" className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white p-5 shadow-sm dark:bg-slate-900"><h2 className="text-lg font-bold">Giao dịch liên quan</h2><p className="mt-3 text-sm font-semibold text-slate-500">Sẽ liên kết với module Thu chi sau này.</p></section>
        </div>
      </div>
      {rawNoteOpen && <RawNoteDialog note={rawNoteOpen} close={() => setRawNoteOpen(null)} extract={() => { setRawNoteOpen(null); setManualExtractOpen(rawNoteOpen); }} />}
      {manualExtractOpen && <ManualExtractDialog note={manualExtractOpen} close={() => setManualExtractOpen(null)} />}
    </Shell>
  );
}

function readPrefillCard(cardId: string) {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(`familyhub_bank_card_prefill_${cardId}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as BankAccount; } catch { return null; }
}

function BankCardDetailSkeleton() {
  const block = "animate-pulse rounded-xl bg-slate-100 dark:bg-white/10";
  return <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"><div className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white p-3 shadow-sm dark:bg-slate-900"><div className={`${block} h-11`} /><div className={`${block} mt-3 h-11`} /><div className={`${block} mt-3 h-11`} /></div><div className="space-y-5"><section className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white p-5 shadow-sm dark:bg-slate-900"><div className={`${block} h-7 w-56`} /><div className="mt-5 grid gap-4 md:grid-cols-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className={`${block} h-20`} />)}</div></section><section className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white p-5 shadow-sm dark:bg-slate-900"><div className={`${block} h-6 w-40`} /><div className="mt-4 grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className={`${block} h-16`} />)}</div></section><section className="rounded-2xl border border-[var(--app-border,#e2e8f0)] bg-white p-5 shadow-sm dark:bg-slate-900"><div className={`${block} h-6 w-44`} /><div className={`${block} mt-4 h-24`} /></section></div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-100">{value}</p></div>;
}

function RawNoteDialog({ note, close, extract }: { note: BankRawNote; close: () => void; extract: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center md:p-6" onMouseDown={close}><div onMouseDown={event => event.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 md:max-w-3xl md:rounded-3xl"><h2 className="text-lg font-bold">{note.title}</h2><p className="mt-2 text-sm font-semibold text-slate-500">{note.bankName} · {note.contentType}</p><pre className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-white/5 dark:text-slate-100">{note.rawText}</pre><div className="mt-6 flex flex-wrap justify-end gap-3"><button onClick={extract} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">Trích xuất thủ công</button><button onClick={extract} className="rounded-xl border border-indigo-200 px-4 py-3 text-sm font-bold text-indigo-600">Tạo ưu đãi từ nội dung này</button><button onClick={close} className="rounded-xl border border-[var(--app-border,#e2e8f0)] px-4 py-3 text-sm font-bold">Đóng</button></div></div></div>;
}

function ManualExtractDialog({ note, close }: { note: BankRawNote; close: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center md:p-6" onMouseDown={close}><div onMouseDown={event => event.stopPropagation()} className="w-full rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 md:max-w-2xl md:rounded-3xl"><h2 className="text-lg font-bold">Trích xuất thủ công</h2><p className="mt-1 text-sm text-slate-400">{note.title}</p><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Phí thường niên"><input className={inputClass} type="number" min="0" /></Field><Field label="Điều kiện miễn phí"><input className={inputClass} /></Field><Field label="Cashback %"><input className={inputClass} type="number" min="0" /></Field><Field label="Danh mục áp dụng"><input className={inputClass} /></Field><Field label="Hạn mức hoàn tiền"><input className={inputClass} type="number" min="0" /></Field></div><div className="mt-6 flex justify-end gap-3"><button onClick={close} className="rounded-xl border border-[var(--app-border,#e2e8f0)] px-4 py-3 text-sm font-bold">Đóng</button><button onClick={close} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">Lưu nháp trích xuất</button></div></div></div>;
}

function extractBankInfo(rawText: string, bankName: string, hasImage: boolean): BankExtractedPayload {
  const text = rawText.toLocaleLowerCase("vi-VN");
  const knownBidv: readonly [string, BankCardNetwork, BankCardType][] = [
    ["Visa Infinite", "Visa", "Thẻ tín dụng"],
    ["Visa Easy", "Visa", "Thẻ tín dụng"],
    ["Visa Cashback Online", "Visa", "Thẻ tín dụng"],
    ["Visa Cashback 360", "Visa", "Thẻ tín dụng"],
    ["Visa Flexi", "Visa", "Thẻ tín dụng"],
    ["Mastercard World Travel", "Mastercard", "Thẻ tín dụng"],
    ["JCB Ultimate", "JCB", "Thẻ tín dụng"],
    ["JCB Platinum Well-being", "JCB", "Thẻ tín dụng"],
  ];
  const moneyValues = [...rawText.matchAll(/(\d[\d.,]*)\s*(?:đ|vnd|vnđ)/gi)].map(match => Number(match[1].replace(/[^\d]/g, ""))).filter(Boolean);
  const percentValues = [...rawText.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)].map(match => Number(match[1].replace(",", "."))).filter(Boolean);
  const found = knownBidv.filter(([name]) => text.includes(name.toLocaleLowerCase("vi-VN")));
  const cards = (found.length ? found : bankName === "BIDV" || hasImage ? knownBidv : [["Thẻ ngân hàng", "Visa", "Thẻ tín dụng"] as [string, BankCardNetwork, BankCardType]]).map(([name, network, type], index) => {
    const cashback = name.includes("Cashback") ? 10 : percentValues[index] || percentValues[0] || 0;
    return {
      product_name: `${bankName} ${name}`.trim(),
      card_network: network,
      card_type: type,
      annual_fee_amount: moneyValues[index] || moneyValues[0] || 0,
      annual_fee_waiver_target: moneyValues[index + 1] || moneyValues[1] || 0,
      interest_rate: rawText.match(/lãi suất[^.\n:]*(?:[:\s]+)([^\n]+)/i)?.[1]?.trim() || "",
      foreign_transaction_fee: rawText.match(/phí giao dịch nước ngoài[^.\n:]*(?:[:\s]+)([^\n]+)/i)?.[1]?.trim() || "",
      cashback_rules: [{
        category: name.includes("Cashback 360") ? "Thiết yếu" : "Khác",
        benefit_type: "cashback_percent",
        benefit_value: cashback,
        monthly_cap: null,
        condition_note: name.includes("Cashback 360") ? "Hoàn tiền 10% tại nhiều lĩnh vực chi tiêu thiết yếu" : "Dữ liệu trích xuất cần user kiểm tra lại",
      }],
      raw_note: "Dữ liệu trích xuất tự động, vui lòng kiểm tra lại với thông tin chính thức từ ngân hàng.",
    } satisfies BankExtractedCard;
  });
  return { bank_name: bankName, cards };
}
