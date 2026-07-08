const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/family-app.tsx');
let content = fs.readFileSync(file, 'utf8');

const sheetCode = `
function CreditCardSheet({ close, user, refresh }: { close: () => void, user: any, refresh: () => void }) {
  const ui = useUI();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ cards: any[], pendingCreditTotal: number }>({ cards: [], pendingCreditTotal: 0 });
  const [activeTab, setActiveTab] = useState<string>("all");
  const [payCard, setPayCard] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/credit-cards/summary');
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handlePaymentSuccess = () => {
    load();
    refresh();
  };

  return <FullScreenMobileSheet close={close} title="Tạm tính thẻ tín dụng">
    <div className="min-h-[100dvh] bg-[#F8F5F2] px-4 pb-28 pt-4 text-[#171018]">
      {loading ? <p className="text-center mt-10 text-sm text-[#6B5E64]">Đang tải...</p> : <>
        <div className="mb-4 rounded-[20px] border border-[#E8DCD5] bg-white p-4 shadow-sm">
          <p className="text-[13px] font-medium text-[#6B5E64]">Tổng nợ tạm tính</p>
          <b className="block text-[28px] font-bold text-[#E11D48]">{money(data.pendingCreditTotal)}</b>
        </div>
        
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setActiveTab("all")} className={"whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-colors " + (activeTab === "all" ? "bg-[#800020] text-white shadow-md" : "bg-[#F8E7EC] text-[#800020]")}>Tất cả thẻ</button>
          {data.cards.map(c => (
            <button key={c.id} onClick={() => setActiveTab(c.id)} className={"whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-semibold transition-colors " + (activeTab === c.id ? "bg-[#800020] text-white shadow-md" : "bg-[#F8E7EC] text-[#800020]")}>{c.name}</button>
          ))}
        </div>

        <div className="space-y-4">
          {activeTab === "all" ? (
            data.cards.length === 0 ? <p className="text-center text-sm text-[#6B5E64]">Không có thẻ tín dụng nào.</p> : 
            data.cards.map(c => (
              <div key={c.id} className="rounded-[16px] border border-[#E8DCD5] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <b className="block text-[15px] font-bold text-[#171018]">{c.name}</b>
                    {c.due_date && <p className="mt-0.5 text-[12px] text-[#6B5E64]">Hạn thanh toán: ngày {c.due_date}</p>}
                  </div>
                  <b className="text-[16px] font-bold text-[#E11D48]">{money(c.pendingTotal)}</b>
                </div>
                {c.pendingTransactions?.length > 0 ? (
                  <>
                    <div className="mb-3 space-y-2 border-t border-[#F8F5F2] pt-3">
                      {c.pendingTransactions.map((t: any) => (
                        <div key={t.id} className="flex justify-between text-[13px]">
                          <span className="truncate pr-2 text-[#171018]">{t.description || "Giao dịch"}</span>
                          <span className="shrink-0 font-medium text-[#E11D48]">{money(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setPayCard(c)} className="w-full rounded-xl bg-[#800020] py-2.5 text-[13px] font-bold text-white shadow-sm active:scale-[0.98] transition-transform">Thanh toán thẻ</button>
                  </>
                ) : (
                  <p className="mt-2 text-[13px] italic text-[#6B5E64]">Thẻ này chưa có khoản tạm tính.</p>
                )}
              </div>
            ))
          ) : (() => {
            const c = data.cards.find(x => x.id === activeTab);
            if (!c) return null;
            return (
              <div className="rounded-[16px] border border-[#E8DCD5] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <b className="block text-[15px] font-bold text-[#171018]">{c.name}</b>
                    {c.due_date && <p className="mt-0.5 text-[12px] text-[#6B5E64]">Hạn thanh toán: ngày {c.due_date}</p>}
                  </div>
                  <b className="text-[16px] font-bold text-[#E11D48]">{money(c.pendingTotal)}</b>
                </div>
                {c.pendingTransactions?.length > 0 ? (
                  <>
                    <div className="mb-3 space-y-2 border-t border-[#F8F5F2] pt-3">
                      {c.pendingTransactions.map((t: any) => (
                        <div key={t.id} className="flex justify-between text-[13px]">
                          <span className="truncate pr-2 text-[#171018]">{t.description || "Giao dịch"}</span>
                          <span className="shrink-0 font-medium text-[#E11D48]">{money(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setPayCard(c)} className="w-full rounded-xl bg-[#800020] py-2.5 text-[13px] font-bold text-white shadow-sm active:scale-[0.98] transition-transform">Thanh toán thẻ</button>
                  </>
                ) : (
                  <p className="py-10 text-center text-[13px] italic text-[#6B5E64]">Chưa có khoản tạm tính.</p>
                )}
              </div>
            );
          })()}
        </div>
      </>}
    </div>
    {payCard && <CreditCardPaymentModal card={payCard} close={() => setPayCard(null)} onSuccess={handlePaymentSuccess} />}
  </FullScreenMobileSheet>;
}

function CreditCardPaymentModal({ card, close, onSuccess }: any) {
  const ui = useUI();
  const [saving, setSaving] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [sources, setSources] = useState<any[]>([]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    fetch('/api/bank-accounts').then(r => r.json()).then(res => {
      if (res.ok) {
        const list = Array.isArray(res.data) ? res.data : [];
        // filter out credit cards
        const validSources = list.filter((x: any) => {
          const t = normalizeCardType(x.card_type);
          return t === "cash" || t === "bank_account" || t === "debit" || t === "wallet";
        });
        setSources(validSources);
        if (validSources.length > 0) setSourceId(validSources[0].id);
      }
    });
  }, []);

  const handlePay = async () => {
    if (!sourceId) return ui.toast("Vui lòng chọn nguồn tiền thanh toán", "error");
    if (!paymentDate) return ui.toast("Vui lòng chọn ngày thanh toán", "error");
    setSaving(true);
    try {
      const res = await fetch('/api/credit-cards/pay', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, sourceId, paymentDate })
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Thanh toán thất bại");
      ui.toast("Đã thanh toán thẻ thành công!", "success");
      onSuccess();
      close();
    } catch (err: any) {
      ui.toast(err.message, "error");
    }
    setSaving(false);
  };

  return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <div className="w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
      <div className="mb-4 text-center">
        <h3 className="text-[18px] font-bold text-[#171018]">Thanh toán dư nợ</h3>
        <p className="mt-1 text-[13px] text-[#6B5E64]">{card.name}</p>
      </div>
      
      <div className="mb-5 rounded-xl bg-[#F8E7EC] p-4 text-center">
        <p className="text-[12px] font-semibold text-[#800020]">Tổng tiền thanh toán</p>
        <b className="block text-[24px] font-bold text-[#E11D48]">{money(card.pendingTotal)}</b>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-[#6B5E64]">Nguồn tiền thanh toán (Tiền mặt, ATM, Ví)</span>
          <select value={sourceId} onChange={e => setSourceId(e.target.value)} className="h-12 w-full rounded-xl border border-[#E8DCD5] bg-white px-3 text-[14px] text-[#171018] outline-none focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/10">
            <option value="" disabled>Chọn nguồn tiền</option>
            {sources.map(s => <option key={s.id} value={s.id}>{s.name} ({normalizeCardType(s.card_type)})</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-[#6B5E64]">Ngày thanh toán</span>
          <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="h-12 w-full rounded-xl border border-[#E8DCD5] bg-white px-3 text-[14px] text-[#171018] outline-none focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/10" />
        </label>
      </div>

      <div className="mt-6 flex gap-3">
        <button type="button" onClick={close} disabled={saving} className="h-12 flex-1 rounded-xl bg-[#F8F5F2] text-[14px] font-bold text-[#171018] active:scale-95 transition-transform disabled:opacity-50">Hủy</button>
        <button type="button" onClick={handlePay} disabled={saving} className="h-12 flex-1 rounded-xl bg-[#800020] text-[14px] font-bold text-white shadow-md active:scale-95 transition-transform disabled:opacity-50">{saving ? "Đang xử lý..." : "Xác nhận"}</button>
      </div>
    </div>
  </div>;
}

`;

content += "\n" + sheetCode;
fs.writeFileSync(file, content);

content = content.replace(
  '<div onClick={() => {}} className="cursor-pointer rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)] active:scale-[0.98] transition-transform">\n        <div className="flex items-center justify-between">\n          <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Tạm tính thẻ tín dụng</p>',
  '<div onClick={() => setShowCreditSheet(true)} className="cursor-pointer rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)] active:scale-[0.98] transition-transform">\n        <div className="flex items-center justify-between">\n          <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Tạm tính thẻ tín dụng</p>'
);
fs.writeFileSync(file, content);
console.log("Done");
