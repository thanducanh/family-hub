const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Hook up the click handler on Nợ thẻ tín dụng
const pendingHtml = `<div className="flex justify-between items-center mb-1">
              <span className="text-[13px] font-semibold text-[#6B5E64]">Nợ thẻ tín dụng:</span>
              <span className="font-bold text-[#E11D48]">{loadingOverview ? "..." : (typeof pendingCredit !== 'undefined' ? money(pendingCredit) : "0 đ")}</span>
            </div>`;
const newPendingHtml = `<div className="flex justify-between items-center mb-1 cursor-pointer active:opacity-70 group" onClick={() => setShowCreditPendingSheet && setShowCreditPendingSheet(true)}>
              <span className="text-[13px] font-semibold text-[#6B5E64] flex items-center gap-1 group-hover:text-[#800020]">Nợ thẻ tín dụng <svg className="size-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></span>
              <span className="font-bold text-[#E11D48]">{loadingOverview ? "..." : (typeof pendingCredit !== 'undefined' ? money(pendingCredit) : "0 đ")}</span>
            </div>`;
if (content.includes(pendingHtml)) {
  content = content.replace(pendingHtml, newPendingHtml);
}

// Add state to MobileTransactionList
const stateTarget = `const [loadingIncomes, setLoadingIncomes] = useState(true);`;
const stateReplacement = `const [loadingIncomes, setLoadingIncomes] = useState(true);
  const [showCreditPendingSheet, setShowCreditPendingSheet] = useState(false);`;
if (content.includes(stateTarget)) {
  content = content.replace(stateTarget, stateReplacement);
}

// Add CreditPendingSheet rendering at the end of MobileTransactionList
const endTarget = `    {detail && <MobileTransactionDetail item={detail} close={() => setDetail(null)} onEdit={() => editItem(detail)} onDeleted={() => { refresh(); setDetail(null); }} data={appData} update={update} />}
    {editor && <MobileTransactionEditor item={editor.isNew ? null : editor} defaultType={editor.type} allowTypeChange={editor.isNew && subTab === "all"} close={() => setEditor(null)} onSaved={() => { refresh(); }} user={user} data={appData} update={update} />}
  </div>;
}`;
const endReplacement = `    {detail && <MobileTransactionDetail item={detail} close={() => setDetail(null)} onEdit={() => editItem(detail)} onDeleted={() => { refresh(); setDetail(null); }} data={appData} update={update} />}
    {editor && <MobileTransactionEditor item={editor.isNew ? null : editor} defaultType={editor.type} allowTypeChange={editor.isNew && subTab === "all"} close={() => setEditor(null)} onSaved={() => { refresh(); }} user={user} data={appData} update={update} />}
    {showCreditPendingSheet && <CreditPendingSheet close={() => setShowCreditPendingSheet(false)} />}
  </div>;
}`;
if (content.includes(endTarget)) {
  content = content.replace(endTarget, endReplacement);
}

// Now append CreditPendingSheet component definition
const newComponent = `
function CreditPendingSheet({ close }: { close: () => void }) {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<any[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/bank-accounts").then(res => res.json()),
      fetch("/api/card-pending-transactions?status=pending").then(res => res.json())
    ]).then(([accountsRes, pendingRes]) => {
      const allAccounts = toArray(accountsRes?.data || accountsRes);
      const allPending = toArray(pendingRes?.data || pendingRes);
      
      const creditCards = allAccounts.filter(a => a.type === "credit_card" || a.type === "credit" || String(a.cardType).toLowerCase() === "credit");
      
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
                    <p className="text-[15px] font-bold text-[#E11D48]">{money(card.pendingAmount)}</p>
                    {card.pendingAmount > 0 && <button className="mt-2 text-[12px] font-bold text-[#800020] bg-[#F8E7EC] px-3 py-1.5 rounded-lg active:opacity-70">Thanh toán thẻ</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
`;

if (!content.includes('function CreditPendingSheet')) {
  content += '\n' + newComponent;
}

fs.writeFileSync(file, content);
console.log("Patched family-app.tsx with CreditPendingSheet");
