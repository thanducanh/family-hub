const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

const codeToAppend = `
function dedupePendingItems(items: any[]) {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
function pendingBankAccountId(item: any) {
  return item.bank_account_id || item.bankAccountId;
}
function pendingCardName(item: any) {
  if (item.bankName === "HSBC" && item.displayName === "Live+") return "HSBC Live+";
  if (item.bank_name === "HSBC" && item.display_name === "Live+") return "HSBC Live+";
  return item.displayName || item.display_name || item.productName || item.product_name || item.bankName || item.bank_name || "Thẻ không xác định";
}
function formatCardNameForTab(b: any) {
  if (b.bankName === "HSBC" && b.displayName === "Live+") return "HSBC Live+";
  return b.displayName || b.productName || b.bankName || "Thẻ tín dụng";
}

export function CreditPendingSheet({ close, bankAccounts }: { close: () => void, bankAccounts: any[] }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingCard, setPayingCard] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const ui = useUI();

  const load = () => {
    setLoading(true);
    fetch("/api/card-pending-transactions/all", { cache: "no-store" })
      .then(res => res.json())
      .then(res => {
        setData(dedupePendingItems(res?.data || []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  
  useEffect(() => { load(); }, []);

  const activeCreditCards = bankAccounts.filter(b => (b.cardType === "credit" || b.cardType === "Thẻ tín dụng") && (b.status === "active" || b.status === "Đang dùng" || b.status === "enabled"));
  
  const groups = data.reduce((acc, item) => {
    const id = pendingBankAccountId(item) || "unlinked";
    if (!acc[id]) acc[id] = [];
    acc[id].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  if (payingCard) {
    const total = groups[payingCard] ? groups[payingCard].reduce((sum: number, item: any) => sum + Number(item.amount), 0) : 0;
    const bankAccount = bankAccounts.find(b => String(b.id) === payingCard) || null;
    const cardName = bankAccount ? formatCardNameForTab(bankAccount) : "Thẻ chưa liên kết";
    return <CreditPaymentForm card={{ id: payingCard, cardName, total }} bankAccounts={bankAccounts} close={() => setPayingCard(null)} onPaid={() => { setPayingCard(null); load(); }} />;
  }

  let displayedCards: any[] = [];
  if (activeTab === "all") {
    displayedCards = Object.keys(groups).map(id => {
      const firstItem = groups[id][0] || {};
      const hasLinkedCard = id !== "unlinked" && Boolean(firstItem.bankName || firstItem.bank_name || firstItem.displayName || firstItem.display_name || firstItem.productName || firstItem.product_name);
      const bankAccount = bankAccounts.find(b => String(b.id) === id) || null;
      const cardName = hasLinkedCard ? pendingCardName(firstItem) : "Thẻ chưa liên kết";
      const total = groups[id].reduce((sum: number, item: any) => sum + Number(item.amount), 0);
      const items = groups[id].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { id, cardName, total, items, bankAccount, hasLinkedCard };
    });
  } else {
    const bankAccount = activeCreditCards.find(b => String(b.id) === activeTab);
    const id = activeTab;
    const items = groups[id] ? groups[id].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
    const total = items.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
    const cardName = bankAccount ? formatCardNameForTab(bankAccount) : "Thẻ tín dụng";
    displayedCards = [{ id, cardName, total, items, bankAccount, hasLinkedCard: true }];
  }

  return (
    <FullScreenMobileSheet close={close}>
      <div className="flex flex-col border-b border-[var(--app-border)] bg-[var(--app-nav)] sticky top-0 z-10">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-lg font-bold">Tạm tính thẻ tín dụng</h2>
          <button onClick={close} className="rounded-full bg-slate-100 p-2 dark:bg-white/10 text-slate-500 hover:text-black dark:hover:text-white"><svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="flex overflow-x-auto px-4 pb-2 space-x-2 scrollbar-hide">
          <button onClick={() => setActiveTab("all")} className={\`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium \${activeTab === "all" ? "bg-[#800020] text-white" : "bg-[#F8F5F2] text-[#6B5E64]"}\`}>Tất cả</button>
          {activeCreditCards.map(b => (
            <button key={b.id} onClick={() => setActiveTab(String(b.id))} className={\`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium \${activeTab === String(b.id) ? "bg-[#800020] text-white" : "bg-[#F8F5F2] text-[#6B5E64]"}\`}>
              {formatCardNameForTab(b)}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-4">
        {loading ? <div className="text-center text-sm py-10">Đang tải...</div> : (displayedCards.length === 0 || (activeTab !== "all" && displayedCards[0].items.length === 0)) ? <div className="text-center text-sm py-10">{activeTab === "all" ? "Không có khoản tạm tính nào." : "Thẻ này chưa có khoản tạm tính."}</div> : displayedCards.map(card => (
          card.items.length > 0 && <div key={card.id} className="bg-[var(--app-card)] rounded-[20px] shadow-sm border border-[var(--app-border)] p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-[16px] text-[#171018] dark:text-white">{card.cardName}</h3>
              <b className="text-[16px] text-[#E11D48]">{card.total.toLocaleString("vi-VN")} đ</b>
            </div>
            <div className="divide-y divide-[#E8DCD5] dark:divide-white/10 bg-[#F8E7EC]/50 dark:bg-black/20 rounded-xl mb-4">
              {card.items.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center p-3 text-[13px]">
                  <div className="min-w-0">
                    <b className="block truncate">{item.title}</b>
                    <span className="text-[#6B5E64] block truncate">{item.date} • {item.category}</span>
                  </div>
                  <b className="shrink-0">{Number(item.amount).toLocaleString("vi-VN")} đ</b>
                </div>
              ))}
            </div>
            {card.hasLinkedCard && card.total > 0 && <button onClick={() => setPayingCard(card.id)} className="w-full rounded-xl bg-[#800020] px-4 py-3 text-[14px] font-bold text-white active:scale-95 transition-transform">
              Thanh toán thẻ
            </button>}
          </div>
        ))}
      </div>
    </FullScreenMobileSheet>
  );
}

export function CreditPaymentForm({ card, bankAccounts, close, onPaid }: { card: any, bankAccounts: any[], close: () => void, onPaid: () => void }) {
  const [source, setSource] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const ui = useUI();

  const activeSources = bankAccounts.filter(b => (b.status === "active" || b.status === "Đang dùng" || b.status === "enabled") && String(b.id) !== String(card.id));

  const submit = async () => {
    setSaving(true);
    const body = {
      paymentMethod: source === "cash" ? "cash" : "transfer",
      paymentAccountId: source === "cash" ? null : source,
      date
    };
    
    try {
      const res = await fetch(\`/api/bank-accounts/\${card.id}/pay\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        ui.toast(data.error || "Thanh toán lỗi", "error");
        setSaving(false);
      } else {
        ui.toast("Thanh toán dư nợ thành công");
        onPaid();
      }
    } catch {
      ui.toast("Lỗi kết nối", "error");
      setSaving(false);
    }
  };

  return (
    <FullScreenMobileSheet close={close}>
      <div className="flex items-center justify-between border-b border-[var(--app-border)] p-4 bg-[var(--app-nav)] sticky top-0 z-10">
        <h2 className="text-lg font-bold">Thanh toán thẻ</h2>
        <button onClick={close} className="rounded-full bg-slate-100 p-2 dark:bg-white/10 text-slate-500"><svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
      <div className="p-4 space-y-4">
        <div className="text-center py-4 bg-rose-50 dark:bg-rose-950/20 rounded-2xl">
          <p className="text-sm font-medium mb-1">Tổng thanh toán cho thẻ {card.cardName}</p>
          <b className="text-3xl text-rose-600">{card.total.toLocaleString("vi-VN")} đ</b>
        </div>
        
        <Field label="Nguồn tiền thanh toán">
          <select className="flex h-11 w-full items-center justify-between rounded-xl border-none bg-white px-3 text-[15px] font-semibold text-[#171018] shadow-sm outline-none ring-1 ring-inset ring-[#E8DCD5] focus:ring-2 focus:ring-inset focus:ring-[#800020] dark:bg-white/5 dark:text-white dark:ring-white/10 dark:focus:ring-white/20" value={source} onChange={e => setSource(e.target.value)}>
            <option value="">Chọn nguồn tiền...</option>
            <option value="cash">Tiền mặt</option>
            {activeSources.map(b => (
              <option key={b.id} value={b.id}>{b.displayName || b.productName || b.bankName} • {b.cardType === "credit" || b.cardType === "Thẻ tín dụng" ? "Thẻ tín dụng" : "Thẻ ghi nợ"}</option>
            ))}
          </select>
        </Field>

        <Field label="Ngày thanh toán">
          <input type="date" className="flex h-11 w-full items-center justify-between rounded-xl border-none bg-white px-3 text-[15px] font-semibold text-[#171018] shadow-sm outline-none ring-1 ring-inset ring-[#E8DCD5] focus:ring-2 focus:ring-inset focus:ring-[#800020] dark:bg-white/5 dark:text-white dark:ring-white/10 dark:focus:ring-white/20" value={date} onChange={e => setDate(e.target.value)} />
        </Field>

        <button disabled={!source || saving} onClick={submit} className="w-full rounded-xl bg-rose-600 px-4 py-3 text-[14px] font-bold text-white active:scale-95 transition-transform disabled:opacity-50 mt-4">
          {saving ? "Đang xử lý..." : "Xác nhận thanh toán"}
        </button>
      </div>
    </FullScreenMobileSheet>
  );
}

export function PaidPendingSheet({ txId, close }: { txId: string, close: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(\`/api/card-pending-transactions/by-payment/\${txId}\`, { cache: "no-store" })
      .then(res => res.json())
      .then(res => {
        setData(res?.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [txId]);

  return (
    <FullScreenMobileSheet close={close}>
      <div className="flex items-center justify-between border-b border-[var(--app-border)] p-4 bg-[var(--app-nav)] sticky top-0 z-10">
        <h2 className="text-lg font-bold">Khoản chi đã thanh toán</h2>
        <button onClick={close} className="rounded-full bg-slate-100 p-2 dark:bg-white/10 text-slate-500"><svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
      <div className="p-4">
        {loading ? <p>Đang tải...</p> : data.length === 0 ? <p>Không có dữ liệu.</p> : (
           <div className="divide-y divide-[#E8DCD5] dark:divide-white/10 bg-[#F8E7EC]/50 dark:bg-black/20 rounded-xl mb-4">
              {data.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center p-3 text-[13px]">
                  <div className="min-w-0">
                    <b className="block truncate">{item.title}</b>
                    <span className="text-[#6B5E64] block truncate">{item.date} • {item.category}</span>
                  </div>
                  <b className="shrink-0">{Number(item.amount).toLocaleString("vi-VN")} đ</b>
                </div>
              ))}
            </div>
        )}
      </div>
    </FullScreenMobileSheet>
  );
}
`;

if (!content.includes('CreditPendingSheet')) {
  fs.writeFileSync(file, content + codeToAppend);
  console.log("Appended");
} else {
  console.log("Already exists");
}
