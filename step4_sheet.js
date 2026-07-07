const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /function CreditPendingSheet\(\{ close \}: \{ close: \(\) => void \}\) \{[\s\S]*?document\.body\s*\);\s*\}/;

const newComponent = `function CreditPendingSheet({ close }: { close: () => void }) {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<any[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  
  const [payingCard, setPayingCard] = useState<any>(null);
  const [paySourceId, setPaySourceId] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/bank-accounts").then(res => res.json()),
      fetch("/api/card-pending-transactions?status=pending").then(res => res.json())
    ]).then(([accountsRes, pendingRes]) => {
      const accounts = toArray(accountsRes?.data || accountsRes);
      setAllAccounts(accounts);
      const allPending = toArray(pendingRes?.data || pendingRes);
      
      const creditCards = accounts.filter(a => normalizeCardType(a.cardType) === "credit" || normalizeCardType(a.type) === "credit");
      
      let total = 0;
      const cardsWithPending = creditCards.map(card => {
        const cardPendingTxs = allPending.filter(tx => String(tx.bankAccountId || tx.bank_account_id) === String(card.id));
        const pendingAmount = cardPendingTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        total += pendingAmount;
        return {
          ...card,
          pendingAmount
        };
      });
      
      setCards(cardsWithPending);
      setPendingTotal(total);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCard || !paySourceId) return;
    setPaying(true);
    try {
      const res = await fetch(\`/api/bank-accounts/\${payingCard.id}/pay\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentAccountId: paySourceId, paymentMethod: "transfer", date: new Date().toISOString().slice(0, 10) })
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const json = await res.json();
        alert(json.error || "Thanh toán thất bại");
        setPaying(false);
      }
    } catch (err) {
      alert("Lỗi kết nối");
      setPaying(false);
    }
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end min-[769px]:hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={close} />
      <div className="relative flex flex-col max-h-[85vh] w-full animate-slide-up rounded-t-[24px] bg-[#F8F5F2] shadow-2xl">
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-[#E8DCD5]">
          <h2 className="text-[17px] font-bold text-[#171018]">Tạm tính thẻ tín dụng</h2>
          <button type="button" onClick={close} className="grid size-8 place-items-center rounded-full bg-black/5 active:bg-black/10 text-[#6B5E64]">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-2xl border border-[#E8DCD5] bg-white p-4 shadow-sm text-center">
            <p className="text-[13px] font-medium text-[#6B5E64]">Tổng nợ thẻ tín dụng</p>
            <p className="mt-1 text-[24px] font-bold text-[#E11D48]">{loading ? "..." : money(pendingTotal)}</p>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-[14px] font-bold text-[#171018] ml-1">Danh sách thẻ</h3>
            {loading ? <p className="text-center text-sm text-[#6B5E64] py-8">Đang tải...</p> : cards.length === 0 ? <p className="text-center text-sm text-[#6B5E64] py-8">Không có thẻ tín dụng</p> : cards.map(card => (
              <div key={card.id} className="rounded-2xl border border-[#E8DCD5] bg-white p-4 shadow-sm">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h4 className="font-semibold text-[#171018]">{card.productName || card.product_name || card.bankName || card.bank_name || "Thẻ tín dụng"}</h4>
                    <p className="text-[12px] text-[#6B5E64] mt-0.5">{card.bankName || card.bank_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-[#E11D48]">{card.pendingAmount > 0 ? money(card.pendingAmount) : "0 đ"}</p>
                    {card.pendingAmount > 0 && <button onClick={() => setPayingCard(card)} className="mt-2 text-[12px] font-bold text-[#800020] bg-[#F8E7EC] px-3 py-1.5 rounded-lg active:opacity-70">Thanh toán thẻ</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {payingCard && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setPayingCard(null)} />
          <form onSubmit={handlePay} className="relative flex flex-col w-full animate-slide-up rounded-t-[24px] bg-white shadow-2xl p-5">
            <h3 className="text-[16px] font-bold text-[#171018] mb-4">Thanh toán thẻ {payingCard.productName || payingCard.bankName}</h3>
            <p className="text-[14px] text-[#6B5E64] mb-4">Số tiền: <b className="text-[#E11D48]">{money(payingCard.pendingAmount)}</b></p>
            
            <label className="block mb-2 text-[13px] font-semibold text-[#171018]">Nguồn tiền thanh toán</label>
            <select required value={paySourceId} onChange={e => setPaySourceId(e.target.value)} className="w-full rounded-xl border border-[#E8DCD5] bg-[#F8F5F2] px-3 h-12 text-[14px] outline-none focus:border-[#800020] mb-6">
              <option value="">Chọn nguồn tiền...</option>
              {allAccounts.filter(a => normalizeCardType(a.cardType) !== "credit" && normalizeCardType(a.type) !== "credit").map(a => (
                <option key={a.id} value={a.id}>{a.productName || a.product_name || a.bankName || a.bank_name}</option>
              ))}
            </select>
            
            <div className="flex gap-3">
              <button type="button" onClick={() => setPayingCard(null)} className="flex-1 rounded-xl bg-[#F8F5F2] h-12 text-[14px] font-semibold text-[#171018] active:opacity-70">Hủy</button>
              <button type="submit" disabled={paying} className="flex-1 rounded-xl bg-[#800020] h-12 text-[14px] font-semibold text-white active:opacity-70 disabled:opacity-50">{paying ? "Đang xử lý..." : "Xác nhận trả"}</button>
            </div>
          </form>
        </div>
      )}
    </div>,
    document.body
  );
}`;

if (regex.test(content)) {
  content = content.replace(regex, newComponent);
  fs.writeFileSync(file, content);
  console.log("Patched CreditPendingSheet in family-app.tsx successfully.");
} else {
  console.log("Failed to patch CreditPendingSheet in family-app.tsx");
}
