"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BankAccount, BankAccountStatus, BankCardType, Member } from "@/types";
import { formatCardUsageDuration, formatISODateToVN, parseVNDateToISO } from "@/lib/utils";
import { useUI } from "./ui-context";

type AuthUser = { id: string; username: string; displayName: string; avatar: string; role?: string; memberId?: string; is_admin?: boolean; isAdmin?: boolean; account_type?: string; permissions?: { viewMode?: string, modules?: Record<string, boolean> }; };
type FormMode = "new" | "edit";

const bankNames = ["BIDV", "Vietcombank", "Techcombank", "MB", "VPBank", "ACB", "TPBank", "Sacombank", "VIB", "VietinBank", "Agribank", "HSBC", "UOB", "MoMo", "Apple Pay", "ZaloPay", "Khác"];
const bankCardTypes: BankCardType[] = ["Thẻ tín dụng", "Thẻ ghi nợ / ATM", "Ví điện tử", "Tiền mặt", "Tài khoản ngân hàng"];
const formCardTypes = [
  { value: "credit", label: "Thẻ tín dụng" },
  { value: "debit", label: "Thẻ ghi nợ / ATM" },
];
const bankStatuses = [
  { value: "active", label: "Đang dùng" },
  { value: "inactive", label: "Ngừng dùng" },
];
const inputClass = "w-full rounded-xl border border-[#E7DDD6] bg-[#FFFDFC] px-4 py-3 text-sm text-[#2B1B17] outline-none transition focus:border-[#800020] focus:ring-1 focus:ring-[#800020] placeholder:text-[#6B5B57]/50";
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(Number.isFinite(value) ? value : 0) + " ₫";

export function canManageBankCards(currentUser: AuthUser | null | undefined, targetMemberId?: string): boolean {
  if (!currentUser) return false;
  const isSysAdmin = currentUser.role === "full_access" || currentUser.role === "admin" || currentUser.role === "system_admin" || 
                     currentUser.is_admin === true || currentUser.isAdmin === true || currentUser.username === "admin" || currentUser.account_type === "admin";
  const isFamilyAdmin = currentUser.permissions?.viewMode === "all";
  if (isSysAdmin || isFamilyAdmin) return true;
  
  if (!targetMemberId) return false;
  if (currentUser.memberId === targetMemberId || (currentUser as any).member_id === targetMemberId) return true;
  
  if (currentUser.permissions?.viewMode === "custom" && Array.isArray((currentUser.permissions as any).visibleMemberIds)) {
    if ((currentUser.permissions as any).visibleMemberIds.includes(targetMemberId)) return true;
  }
  
  return false;
}


async function readJsonSafe<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

function emptyBankForm(memberId: string): BankAccount {
  return {
    id: crypto.randomUUID(), memberId, bankName: "BIDV", accountHolder: "", accountNumber: "", cardNumber: "",
    accountType: "credit", cardType: "credit", cardNetwork: "Không áp dụng", productName: "", branch: "",
    statementDay: "", dueDay: "", creditLimit: 0, expiryMonth: "", expiryYear: "", status: "active",
    annualFeeEnabled: false, annualFeeAmount: 0, annualFeeWaiverType: "Không có", annualFeeWaiverTarget: 0, annualFeeCycle: "năm", annualFeeCycleStart: "", annualFeeCurrentSpending: 0, note: "", benefits: [], rewards: [], openedAt: "",
  };
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block text-sm font-semibold text-[#6B5B57]"><span>{label}</span><div className="mt-2">{children}</div>{hint && <span className="mt-1 block text-xs font-medium text-[#6B5B57]/70">{hint}</span>}</label>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-[13px] font-medium text-[#6B5B57] mb-1">{label}</p><div className="font-semibold text-[#2B1B17]">{value}</div></div>;
}

function Shell({ member, title, children }: { member?: Member; title: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[460px] lg:max-w-[600px] pb-24 md:pb-8 min-h-screen md:min-h-0 bg-[#F8F5F2] md:rounded-[32px] md:shadow-lg md:overflow-hidden md:border md:border-[#E7DDD6]">
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between bg-white px-4 shadow-sm border-b border-[#E7DDD6]">
        <button
          onClick={() => member ? router.push(`/members/${member.id}/bank-cards`) : router.back()}
          className="flex h-10 w-10 items-center justify-center -ml-2 text-[#2B1B17] hover:bg-[#F8F5F2] rounded-full transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#2B1B17]">{title}</h1>
        <div className="w-10"></div>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

function LoadingState() {
  return <div className="rounded-[24px] border border-[#E7DDD6] bg-[#FFFDFC] p-12 text-center text-sm font-medium text-[#6B5B57] shadow-sm">Đang tải dữ liệu...</div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-8 text-center text-sm font-semibold text-rose-700 shadow-sm">{message}</div>;
}

function ConfirmModal({ isOpen, onClose, onConfirm, hasTransactions, processing }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; hasTransactions: boolean; processing: boolean }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4" onClick={onClose}>
      <div className="w-full max-w-[400px] rounded-[24px] bg-[#FFFDFC] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-[#2B1B17] mb-3">
          {hasTransactions ? "Ngừng dùng thẻ?" : "Xóa thẻ?"}
        </h3>
        <p className="text-[15px] text-[#6B5B57] leading-relaxed mb-8">
          {hasTransactions 
            ? "Thẻ này đã có lịch sử giao dịch nên sẽ không bị xóa vĩnh viễn. Hệ thống sẽ chuyển thẻ sang trạng thái ngừng dùng để giữ lịch sử cũ."
            : "Thẻ này chưa có giao dịch liên quan. Bạn có chắc muốn xóa thẻ khỏi hệ thống không?"}
        </p>
        <div className="flex gap-3 justify-end mt-4">
          <button 
            type="button" 
            onClick={onClose} 
            disabled={processing}
            className="px-5 py-3 rounded-xl border border-[#E7DDD6] bg-white text-[#6B5B57] font-semibold hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button 
            type="button" 
            onClick={onConfirm} 
            disabled={processing}
            className="px-5 py-3 rounded-xl bg-[#800020] text-white font-semibold hover:bg-[#6A001A] transition-colors disabled:opacity-60"
          >
            {processing ? "Đang xử lý..." : (hasTransactions ? "Ngừng dùng" : "Xóa thẻ")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BankCardFormPage({ memberId, cardId, mode }: { memberId: string; cardId?: string; mode: FormMode }) {
  const router = useRouter();
  const ui = useUI();
  const [user, setUser] = useState<AuthUser | null>();
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState<BankAccount>(() => emptyBankForm(memberId));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [hasTransactions, setHasTransactions] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const meResponse = await fetch("/api/auth/me", { credentials: "include", cache: "no-store", headers: { "pragma": "no-cache", "cache-control": "no-cache" } }).catch(() => null);
        const membersResponse = await fetch("/api/members").catch(() => null);
        let cardResponse = null;
        if (mode === "edit" && cardId) {
          cardResponse = await fetch(`/api/bank-accounts/${cardId}`).catch(() => null);
        }
        
        const me = meResponse && meResponse.ok ? await readJsonSafe<{ user?: AuthUser }>(meResponse) : null;
        const memberJson = membersResponse && membersResponse.ok ? await membersResponse.json().catch(() => ({})) : {};
        
        if (!active) return;
        const nextMembers = (Array.isArray(memberJson) ? memberJson : (memberJson.data ?? [])) as Member[];
        const nextUser = me?.user ? me.user : null;
        
        if (!meResponse || !meResponse.ok) {
          if (meResponse && meResponse.status >= 500) {
            throw new Error("Không thể kết nối đến cơ sở dữ liệu. Vui lòng thử lại sau.");
          }
          setAuthError("Không thể xác thực phiên đăng nhập. Vui lòng đăng nhập lại.");
        }
        
        setUser(nextUser);
        setMembers(nextMembers);
        
        if (mode === "edit" && cardId) {
          if (!cardResponse) throw new Error("Lỗi mạng: Không thể tải thông tin thẻ.");
          if (cardResponse.status === 404) throw new Error("Không tìm thấy thẻ.");
          if (cardResponse.status === 401) throw new Error("Phiên đăng nhập đã hết hạn.");
          if (!cardResponse.ok) throw new Error(`Lỗi máy chủ (${cardResponse.status}): Không thể tải dữ liệu thẻ.`);
          
          const cardPayload = await readJsonSafe<any>(cardResponse);
          const found = cardPayload?.data?.account || cardPayload?.data || cardPayload?.card || cardPayload;
          
          if (!me?.user) {
          if (active) setAuthError("Không thể xác thực người dùng.");
          return;
        }

          if (!found || !found.id) {
            throw new Error("Dữ liệu thẻ trả về không hợp lệ.");
          }
          if (cardPayload?.hasTransactions) {
            setHasTransactions(true);
          }
          
            const rawType = found.cardType || found.card_type || found.accountType || found.account_type || 'debit';
            const mappedType = ['credit', 'Thẻ tín dụng', 'credit_card'].includes(rawType) ? 'credit' : 'debit';
            const mappedStatus = ['active', 'Đang dùng', 'enabled'].includes(found.status) ? 'active' : 'inactive';
            setForm({
            ...emptyBankForm(found.memberId || found.member_id || memberId),
            ...found,
            id: found.id,
            memberId: found.memberId || found.member_id || memberId,
            bankName: found.bankName || found.bank_name || 'BIDV',
            productName: found.displayName || found.display_name || found.productName || found.product_name || found.bankName || found.bank_name || '',
            cardType: mappedType as BankCardType,
            status: mappedStatus as BankAccountStatus,
            creditLimit: found.creditLimit ?? found.credit_limit ?? 0,
            statementDay: found.statementDay || found.statement_day || '',
            dueDay: found.dueDay || found.due_day || '',
            note: found.note || '',
            openedAt: found.openedAt || found.opened_at ? formatISODateToVN(found.openedAt || found.opened_at) : ''
          });
        } else {
          const owner = nextMembers.find(member => member.id === memberId);
          setForm({ ...emptyBankForm(memberId), accountHolder: owner?.name || owner?.nickname || "" });
        }
        setLoading(false);
      } catch (err: any) {
        if (active) { 
          setError(err.message || "Lỗi xử lý. Vui lòng thử lại.");
          setLoading(false);
        }
      }
    }
    void load();
    return () => { active = false; };
  }, [cardId, memberId, mode]);

  const currentMember = members.find(member => member.id === form.memberId) || members.find(member => member.id === memberId);
  const canEdit = canManageBankCards(user, form.memberId) || canManageBankCards(user, memberId);
  const isSysAdmin = user?.role === "full_access" || user?.role === "admin" || user?.role === "system_admin" || user?.is_admin === true || user?.isAdmin === true || user?.username === "admin" || user?.account_type === "admin";
  const isFamilyAdmin = user?.permissions?.viewMode === "all";
  const isAdmin = isSysAdmin || isFamilyAdmin;
  const editableMembers = isAdmin ? members : members.filter(member => member.id === user?.memberId);
  const isCredit = form.cardType === "credit" || form.accountType === "credit" || form.cardType === "Thẻ tín dụng";

  function set<K extends keyof BankAccount>(key: K, value: BankAccount[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit || saving) return;
    setSaving(true);
    
    let openedAtIso = form.openedAt;
    if (form.openedAt) {
      const parsed = parseVNDateToISO(form.openedAt);
      if (!parsed) {
        setError("Ngày mở thẻ phải có dạng dd/mm/yyyy");
        setSaving(false);
        return;
      }
      openedAtIso = parsed;
    }

    try {
      setError("");
      const response = await fetch(mode === "new" ? "/api/bank-accounts" : `/api/bank-accounts/${form.id}`, {
        method: mode === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, accountType: form.cardType, openedAt: openedAtIso }),
      });
      const result = await readJsonSafe<{ error?: string; data?: BankAccount }>(response);
      if (!response.ok || !result?.data) { setError(result?.error || "Không lưu được thẻ ngân hàng."); return; }
      router.refresh();
      router.push(`/members/${result.data.memberId}/bank-cards`);
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi hệ thống khi lưu thẻ.");
    } finally { 
      setSaving(false);
    }
  }

  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDelete() {
    if (!cardId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/bank-accounts/${cardId}`, { method: "DELETE" });
      const result = await readJsonSafe<any>(res);
      if (!res.ok) {
        ui.toast(result?.error || "Lỗi khi xử lý thẻ.", "error");
        setDeleting(false);
        return;
      }
      ui.toast(result?.mode === "archived" ? "Đã chuyển thẻ sang trạng thái Ngừng dùng." : "Đã xóa thẻ.", "success");
      router.push(`/members/${memberId}/bank-cards`);
    } catch (err) {
      ui.toast(`Lỗi khi xử lý thẻ.`, "error");
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  }

  if (loading) return <Shell title={mode === "new" ? "Thêm thẻ mới" : "Chỉnh sửa thẻ"} member={currentMember}><LoadingState /></Shell>;
  if (error) return <Shell title={mode === "new" ? "Thêm thẻ mới" : "Chỉnh sửa thẻ"} member={currentMember}><ErrorState message={error} /></Shell>;
  if (authError) return <Shell title="Thẻ" member={currentMember}><ErrorState message={authError} /></Shell>;
  if (!user || !canEdit) return <Shell title="Thẻ" member={currentMember}><ErrorState message="Bạn không có quyền truy cập trang này." /></Shell>;

  return (
    <Shell title={mode === "new" ? "Thêm thẻ mới" : "Chỉnh sửa thẻ"} member={currentMember}>
      <form onSubmit={save} className="mx-auto w-full space-y-4">
        <div className="rounded-[24px] border border-[#E7DDD6] bg-[#FFFDFC] p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4">
            <Field label="Tên thẻ"><input required className={inputClass} value={form.productName} onChange={e => set("productName", e.target.value)} placeholder="Ví dụ: BIDV Visa, MoMo, HSBC Cashback..." /></Field>
            <Field label="Ngân hàng/Tổ chức"><select required className={inputClass} value={form.bankName} onChange={e => set("bankName", e.target.value)}>{bankNames.map(name => <option key={name}>{name}</option>)}</select></Field>
            <Field label="Thành viên quản lý"><select required className={inputClass} value={form.memberId} onChange={e => set("memberId", e.target.value)}>{editableMembers.map(m => <option key={m.id} value={m.id}>{m.nickname || m.name}</option>)}</select></Field>
            <Field label="Loại nguồn tiền"><select className={inputClass} value={form.cardType} onChange={e => { const v = e.target.value as BankCardType; setForm(c => ({ ...c, cardType: v, accountType: v })); }}>{formCardTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field>
            <Field label="Trạng thái"><select className={inputClass} value={form.status} onChange={e => set("status", e.target.value as BankAccountStatus)}>{bankStatuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></Field>
            <Field label="Ngày mở thẻ"><input type="text" className={inputClass} value={form.openedAt || ""} onChange={e => set("openedAt", e.target.value)} placeholder="dd/mm/yyyy" /></Field>
          </div>
        </div>

        {isCredit && (
          <div className="rounded-[24px] border border-[#D4AF37]/40 bg-[#FFFDFC] p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-4">
              <Field label="Hạn mức thẻ (VND)"><input className={inputClass} type="text" inputMode="numeric" value={form.creditLimit ? new Intl.NumberFormat("vi-VN").format(form.creditLimit) : ""} onChange={e => { const val = e.target.value.replace(/\D/g, ""); set("creditLimit", val ? parseInt(val, 10) : 0); }} placeholder="Ví dụ: 50.000.000" /></Field>
              <Field label="Ngày chốt sao kê"><input className={inputClass} inputMode="numeric" value={form.statementDay} onChange={e => set("statementDay", e.target.value)} placeholder="Ví dụ: 15" /></Field>
              <Field label="Ngày đến hạn"><input className={inputClass} inputMode="numeric" value={form.dueDay} onChange={e => set("dueDay", e.target.value)} placeholder="Ví dụ: 30" /></Field>
            </div>
          </div>
        )}

        <div className="rounded-[24px] border border-[#E7DDD6] bg-[#FFFDFC] p-5 shadow-sm">
          <Field label="Ghi chú thêm"><textarea rows={3} className={inputClass} value={form.note} onChange={e => set("note", e.target.value)} placeholder="Thông tin thêm..." /></Field>
          {error && <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>}
        </div>
        
        <div className="flex flex-col gap-3 pt-4 pb-24">
          <button type="submit" disabled={saving || deleting} className="w-full h-12 rounded-xl bg-[#800020] text-base font-bold text-white hover:bg-[#6b001a] disabled:opacity-60 transition-colors shadow-md">{saving ? "Đang xử lý..." : "Lưu thẻ"}</button>
          <button type="button" disabled={saving || deleting} onClick={() => router.back()} className="w-full h-12 rounded-xl border border-[#E7DDD6] bg-white text-base font-bold text-[#6B5B57] hover:bg-[#F8F5F2] transition-colors">Quay lại</button>
          
          {mode === "edit" && (
            <div className="mt-4 pt-4 border-t border-[#E7DDD6]">
              <button type="button" disabled={saving || deleting} onClick={() => setShowConfirm(true)} className="w-full h-12 rounded-xl bg-[#FFF0F0] text-base font-bold text-[#D32F2F] hover:bg-[#FFE0E0] disabled:opacity-60 transition-colors">{deleting ? "Đang xử lý..." : (hasTransactions ? "Ngừng dùng thẻ" : "Xóa thẻ")}</button>
            </div>
          )}
        </div>
      </form>
      <ConfirmModal 
        isOpen={showConfirm} 
        onClose={() => setShowConfirm(false)} 
        onConfirm={handleDelete} 
        hasTransactions={hasTransactions} 
        processing={deleting} 
      />
    </Shell>
  );
}

export function BankCardDetailPage({ memberId, cardId }: { memberId: string; cardId: string }) {
  const router = useRouter();
  const ui = useUI();
  const [owner, setOwner] = useState<Member | null>(null);
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [pendingTxs, setPendingTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasTransactions, setHasTransactions] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "pending" | "paid">("info");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<{ method: string; accountId: string; date: string }>({ method: "transfer", accountId: "", date: new Date().toISOString().slice(0, 10) });
  const [allBankAccounts, setAllBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const res = await fetch(`/api/bank-accounts/${cardId}`);
        const result = await readJsonSafe<any>(res);
        if (!active) return;
        if (!res.ok || !result?.ok) { setError(result?.error || "Không thể tải dữ liệu thẻ. Vui lòng thử lại."); return; }
        
        const acc = result.data?.account || result.data;
        const mem = result.data?.member || result.member;
        if (!acc) { setError("Không tìm thấy thẻ."); return; }
        
        setAccount(acc); setOwner(mem || null);
        if (result?.hasTransactions) setHasTransactions(true);
        
        if (acc.cardType === "Thẻ tín dụng" || acc.accountType === "Thẻ tín dụng") {
          setActiveTab("pending"); // Default to pending for credit
          fetch(`/api/card-pending-transactions?bankAccountId=${acc.id}`).then(r => r.json()).then(resp => {
            if (active && resp.ok && resp.data) setPendingTxs(resp.data);
          }).catch(() => {});
          fetch("/api/bank-accounts").then(r => r.json()).then(resp => {
            if (active && resp.ok && resp.data) setAllBankAccounts(resp.data);
          }).catch(() => {});
        }
      } catch (err: any) {
        if (active) setError("Lỗi kết nối máy chủ. Vui lòng thử lại.");
      }
    }
    void load().finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [cardId]);

  const [showConfirm, setShowConfirm] = useState(false);

  async function handleDelete() {
    if (!cardId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/bank-accounts/${cardId}`, { method: "DELETE" });
      const result = await readJsonSafe<any>(res);
      if (!res.ok) {
        ui.toast(result?.error || "Lỗi khi xử lý thẻ.", "error");
        setDeleting(false);
        return;
      }
      ui.toast(result?.mode === "archived" ? "Đã chuyển thẻ sang trạng thái Ngừng dùng." : "Đã xóa thẻ.", "success");
      router.push(`/members/${memberId}/bank-cards`);
    } catch (err) {
      ui.toast(`Lỗi khi xử lý thẻ.`, "error");
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  }

  if (loading && !account) return <Shell title="Chi tiết thẻ" member={owner || undefined}><LoadingState /></Shell>;
  if (error && !account) return <Shell title="Chi tiết thẻ" member={owner || undefined}><ErrorState message={error} /></Shell>;
  if (!account) return <Shell title="Chi tiết thẻ" member={owner || undefined}><ErrorState message="Không tìm thấy thẻ." /></Shell>;

  const isCredit = account.cardType === "Thẻ tín dụng" || account.accountType === "Thẻ tín dụng";
  const pendingItems = pendingTxs.filter(tx => tx.status === "pending");
  const pendingAmount = pendingItems.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const paidItems = pendingTxs.filter(tx => tx.status === "paid");

  return (
    <Shell title="Chi tiết thẻ" member={owner || undefined}>
      <div className="mx-auto w-full space-y-4">
        
        {/* Card Hero */}
        <div className={`relative w-full rounded-[24px] p-6 sm:p-8 text-white shadow-lg overflow-hidden ${isCredit ? 'bg-gradient-to-br from-[#800020] to-[#4a0011]' : 'bg-gradient-to-br from-[#6B5B57] to-[#2B1B17]'}`}>
          {isCredit && <div className="absolute top-0 right-0 h-64 w-64 -translate-y-20 translate-x-20 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-transparent"></div>}
          <div className="relative z-10 flex flex-col h-full justify-between min-h-[160px]">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold font-serif tracking-wide">
                  {(() => {
                    const name = account.displayName || account.productName;
                    if (!name) return account.bankName;
                    if (name.toLowerCase().includes(account.bankName.toLowerCase())) return name;
                    return `${account.bankName} ${name}`;
                  })()}
                </h2>
                <p className="mt-1 text-sm font-medium opacity-80">{account.bankName} • {isCredit ? "Thẻ tín dụng" : "Thẻ ghi nợ / ATM"}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${isCredit ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-white/20 text-white'}`}>
                  {isCredit ? "Credit" : "Debit"}
                </span>
                {account.status !== "active" && account.status !== "Đang dùng" && (
                  <span className="rounded-md bg-rose-500/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    {account.status === "inactive" ? "Ngừng dùng" : account.status}
                  </span>
                )}
              </div>
            </div>
            
            <div className="mt-8 flex justify-between items-end">
              <div>
                {isCredit && account.creditLimit ? (
                  <>
                    <p className="text-[11px] uppercase tracking-wider opacity-70 mb-1">Hạn mức</p>
                    <p className="text-xl sm:text-2xl font-bold font-mono tracking-tight">{money(account.creditLimit)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] uppercase tracking-wider opacity-70 mb-1">Chủ tài khoản</p>
                    <p className="text-lg font-bold tracking-wide">{account.accountHolder || owner?.name || owner?.nickname || "N/A"}</p>
                  </>
                )}
              </div>
              {isCredit && (
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider opacity-70 mb-1">Sao kê / Hạn</p>
                  <p className="text-sm font-bold font-mono">{account.statementDay || "-"}/{account.dueDay || "-"}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button onClick={() => router.push(`/members/${account.memberId}/bank-cards/${account.id}/edit`)} className="rounded-xl border border-[#800020] bg-white px-5 py-2.5 text-sm font-bold text-[#800020] hover:bg-[#800020]/5 transition-colors">
            Chỉnh sửa thẻ
          </button>
          {isCredit && pendingAmount > 0 && (
            <button onClick={() => setPaymentModalOpen(true)} className="rounded-xl bg-[#800020] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#6b001a] transition-colors">
              Thanh toán ({money(pendingAmount)})
            </button>
          )}
        </div>

        {paymentModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onClick={() => setPaymentModalOpen(false)}>
            <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <h3 className="mb-4 text-xl font-bold text-[#800020]">Thanh toán dư nợ</h3>
              <p className="mb-4 text-sm text-slate-600">Thanh toán tổng dư nợ: <strong className="text-[#800020]">{money(pendingAmount)}</strong>?</p>
              
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Ngày thanh toán</label>
                  <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#800020]" value={paymentForm.date} onChange={e => setPaymentForm(c => ({ ...c, date: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Hình thức thanh toán</label>
                  <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#800020]" value={paymentForm.method} onChange={e => setPaymentForm(c => ({ ...c, method: e.target.value }))}>
                    <option value="transfer">Chuyển khoản</option>
                    <option value="cash">Tiền mặt</option>
                    <option value="bank_account">Tài khoản ngân hàng</option>
                    <option value="bank_card">Thẻ ghi nợ</option>
                    <option value="momo">Ví MoMo</option>
                  </select>
                </div>
                {paymentForm.method !== "cash" && (
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Nguồn tiền (Thẻ/TK)</label>
                    <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#800020]" value={paymentForm.accountId} onChange={e => setPaymentForm(c => ({ ...c, accountId: e.target.value }))}>
                      <option value="">Không chọn tài khoản cụ thể</option>
                      {allBankAccounts.filter(b => b.accountType !== "Thẻ tín dụng" && b.cardType !== "Thẻ tín dụng").map(b => (
                        <option key={b.id} value={b.id}>{b.bankName} - {b.productName || b.cardType || b.accountType}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setPaymentModalOpen(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Hủy</button>
                <button onClick={() => {
                  fetch(`/api/bank-accounts/${account.id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentMethod: paymentForm.method, paymentAccountId: paymentForm.method === "cash" ? "" : paymentForm.accountId, date: paymentForm.date }) })
                    .then(r => r.json()).then(res => {
                      if (res.ok) { ui.toast("Thanh toán thành công!"); setTimeout(() => window.location.reload(), 1000); }
                      else ui.toast(res.error || "Lỗi xử lý", "error");
                    }).catch(() => ui.toast("Lỗi kết nối", "error"));
                }} className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-[#6b001a]">Xác nhận</button>
              </div>
            </div>
          </div>
        )}


        {/* Tabs */}
        <div className={`grid gap-1 rounded-[16px] border border-[#E7DDD6] bg-[#FFFDFC] p-1 shadow-sm ${isCredit ? "grid-cols-3" : "grid-cols-1"}`}>
          {isCredit && <button onClick={() => setActiveTab("pending")} className={`flex items-center justify-center rounded-xl px-1 py-2 text-[11px] sm:text-sm font-bold whitespace-nowrap transition-all ${activeTab === "pending" ? "bg-[#800020]/10 text-[#800020]" : "text-[#6B5B57] hover:bg-[#F8F5F2]"}`}>Tạm tính {pendingItems.length > 0 && <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#800020] text-[9px] text-white shrink-0">{pendingItems.length}</span>}</button>}
          {isCredit && <button onClick={() => setActiveTab("paid")} className={`flex items-center justify-center rounded-xl px-1 py-2 text-[11px] sm:text-sm font-bold whitespace-nowrap transition-all ${activeTab === "paid" ? "bg-[#800020]/10 text-[#800020]" : "text-[#6B5B57] hover:bg-[#F8F5F2]"}`}>Đã thanh toán</button>}
          <button onClick={() => setActiveTab("info")} className={`flex items-center justify-center rounded-xl px-1 py-2 text-[11px] sm:text-sm font-bold whitespace-nowrap transition-all ${activeTab === "info" ? "bg-[#800020]/10 text-[#800020]" : "text-[#6B5B57] hover:bg-[#F8F5F2]"}`}>Thông tin</button>
        </div>

        {/* Tab Content */}
        {activeTab === "info" && (
          <div className="rounded-[24px] border border-[#E7DDD6] bg-[#FFFDFC] p-6 shadow-sm">
            <h3 className="mb-5 text-lg font-bold text-[#800020]">Chi tiết nguồn tiền</h3>
            <div className="grid gap-4 grid-cols-1">
              <Info label="Chủ tài khoản" value={account.accountHolder || owner?.nickname || "Trống"} />
              <Info label="Ngày mở thẻ" value={account.openedAt ? formatISODateToVN(account.openedAt) : "Chưa cập nhật"} />
              <Info label="Thời gian sử dụng" value={formatCardUsageDuration(account.openedAt)} />
              <Info label="Trạng thái" value={<span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${account.status === "active" || account.status === "Đang dùng" ? "bg-[#D4AF37]/20 text-[#800020]" : "bg-[#F8F5F2] text-[#6B5B57]"}`}>{account.status === "active" || account.status === "Đang dùng" ? "Đang dùng" : "Ngừng dùng"}</span>} />
              {isCredit && <Info label="Hạn mức khả dụng" value={account.creditLimit ? money(account.creditLimit) : "Chưa cấu hình"} />}
              {isCredit && <Info label="Kỳ sao kê" value={account.statementDay ? `Ngày ${account.statementDay} hàng tháng` : "Chưa cấu hình"} />}
              {isCredit && <Info label="Hạn thanh toán" value={account.dueDay ? `Ngày ${account.dueDay} hàng tháng` : "Chưa cấu hình"} />}
              <div className="col-span-full border-t border-[#E7DDD6] pt-5">
                <Info label="Ghi chú thêm" value={account.note || <span className="text-[#6B5B57] font-normal italic">Không có ghi chú</span>} />
              </div>
            </div>
          </div>
        )}

        {activeTab === "pending" && isCredit && (
          <div className="rounded-[24px] border border-[#E7DDD6] bg-[#FFFDFC] p-6 shadow-sm">
            <div className="mb-6 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#800020]/5 to-[#D4AF37]/10 py-6 border border-[#D4AF37]/20">
              <p className="text-sm font-semibold text-[#800020] opacity-80">Tổng dư nợ chờ thanh toán</p>
              <p className="mt-1 text-3xl font-bold text-[#800020] font-mono">{money(pendingAmount)}</p>
            </div>
            <div className="space-y-4">
              {pendingItems.length ? pendingItems.map(tx => (
                <div key={tx.id} className="flex flex-col gap-2 rounded-2xl border border-[#E7DDD6] bg-[#F8F5F2]/50 p-4 hover:border-[#D4AF37]/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-[#2B1B17] leading-tight">{tx.title}</p>
                      <p className="text-xs font-medium text-[#6B5B57] mt-1">{tx.date} • <span className="text-[#800020]">{tx.category}</span></p>
                    </div>
                    <p className="text-base font-bold text-[#800020] font-mono whitespace-nowrap ml-3">{money(Number(tx.amount))}</p>
                  </div>
                  {tx.note && <p className="text-[13px] text-[#6B5B57] bg-white rounded-lg p-2 border border-[#E7DDD6]">{tx.note}</p>}
                </div>
              )) : (
                <div className="flex flex-col items-center py-10">
                  <div className="h-12 w-12 rounded-full bg-[#E7DDD6]/50 flex items-center justify-center mb-3">
                    <svg className="h-6 w-6 text-[#6B5B57]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-sm font-semibold text-[#6B5B57]">Bạn đã thanh toán toàn bộ dư nợ.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "paid" && isCredit && (
          <div className="rounded-[24px] border border-[#E7DDD6] bg-[#FFFDFC] p-6 shadow-sm">
            <h3 className="mb-5 text-lg font-bold text-[#800020]">Lịch sử thanh toán</h3>
            <div className="space-y-4">
              {paidItems.length ? paidItems.map(tx => (
                <div key={tx.id} className="flex flex-col gap-2 rounded-2xl border border-[#E7DDD6] bg-white p-4 opacity-75 grayscale-[20%]">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-[#2B1B17] line-through decoration-[#6B5B57]/30">{tx.title}</p>
                      <p className="text-xs font-medium text-[#6B5B57] mt-1">{tx.date} • {tx.category}</p>
                    </div>
                    <p className="text-base font-bold text-[#6B5B57] font-mono whitespace-nowrap ml-3">{money(Number(tx.amount))}</p>
                  </div>
                  {tx.paidAt && <p className="text-[11px] font-bold text-[#800020] uppercase bg-[#800020]/5 self-start px-2 py-1 rounded-md">Đã thanh toán: {tx.paidAt}</p>}
                </div>
              )) : (
                <div className="text-center py-10 text-sm font-semibold text-[#6B5B57]">
                  Chưa có giao dịch nào được ghi nhận.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quản lý thẻ */}
        <div className="rounded-[24px] border border-[#E7DDD6] bg-[#FFFDFC] p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-[#800020]">Quản lý thẻ</h3>
          <p className="mb-4 text-sm font-medium text-[#6B5B57]">
            {hasTransactions ? "Thẻ này đã có lịch sử giao dịch. Nếu bạn không muốn sử dụng thẻ này nữa, hãy chọn ngừng dùng. Các giao dịch cũ vẫn sẽ được giữ lại." : "Thẻ này chưa có giao dịch nào, bạn có thể xóa thẻ vĩnh viễn khỏi hệ thống."}
          </p>
          <button type="button" disabled={deleting} onClick={() => setShowConfirm(true)} className="w-full h-12 rounded-xl bg-[#FFF0F0] text-base font-bold text-[#D32F2F] hover:bg-[#FFE0E0] disabled:opacity-60 transition-colors">
            {deleting ? "Đang xử lý..." : (hasTransactions ? "Ngừng dùng thẻ" : "Xóa thẻ")}
          </button>
        </div>
      </div>
      <ConfirmModal 
        isOpen={showConfirm} 
        onClose={() => setShowConfirm(false)} 
        onConfirm={handleDelete} 
        hasTransactions={hasTransactions} 
        processing={deleting} 
      />
    </Shell>
  );
}
