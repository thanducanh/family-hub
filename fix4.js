const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const r0 = `function getDueDayColor(dueDay?: string | number, today: Date = new Date()) {
  if (!dueDay) return "text-[#6B5E64]";
  const day = Number(dueDay);
  if (isNaN(day)) return "text-[#6B5E64]";
  const currentDay = today.getDate();
  let diff = day - currentDay;
  if (diff < -15) diff += 30;
  if (diff < 0) return "text-[#E11D48]";
  if (diff <= 2) return "text-[#F59E0B]";
  return "text-[#10B981]";
}`;
const t0 = `function getDueDayColor(dueDay?: string | number, today: Date = new Date()) {
  if (!dueDay) return "text-[#6B5E64]";
  const day = Number(dueDay);
  if (isNaN(day)) return "text-[#6B5E64]";
  const currentDay = today.getDate();
  let diff = day - currentDay;
  if (diff < -15) diff += 30; // Handle month crossing roughly
  if (diff < 0) return "text-[#E11D48]"; // Red
  if (diff <= 5) return "text-[#F59E0B]"; // Amber
  return "text-[#6B5E64]";
}`;

const t_useEffect = `  useEffect(() => {
    setPendingCreditLoading(true);
    setPendingCreditError(false);
    Promise.all([
      fetch("/api/card-pending-transactions/all", { cache: "no-store" }).then(res => res.json()).catch(() => null),
      fetch("/api/bank-accounts", { cache: "no-store" }).then(res => res.json()).catch(() => null),
    ])
      .then(([pendingRes, accountRes]) => {
        const items = dedupePendingItems(pendingRes?.data || []).filter((item: any) => item.status !== "paid");
        const accountRows = Array.isArray(accountRes) ? accountRes : Array.isArray(accountRes?.data) ? accountRes.data : Array.isArray(accountRes?.rows) ? accountRes.rows : [];
        const cardsById = new Map(accountRows.map((account: any) => [String(account.id), account]));
        const byCard = items.reduce((result: Record<string, any>, item: any) => {
          const id = String(pendingBankAccountId(item) || "unlinked");
          const account = cardsById.get(id);
          const current = result[id] || { id, account, total: 0, count: 0, items: [] };
          current.total += Number(item.amount || 0);
          current.count += 1;
          current.items.push(item);
          result[id] = current;
          return result;
        }, {});
        const summaries = Object.values(byCard).sort((a: any, b: any) => Number(b.total || 0) - Number(a.total || 0));
        const total = summaries.reduce((sum: number, item: any) => sum + Number(item.total || 0), 0);
        setPendingCredit(total);
        setPendingCreditSummaries(summaries);
        setPendingCreditLoading(false);
      })
      .catch(() => {
        setPendingCreditError(true);
        setPendingCredit(0);
        setPendingCreditSummaries([]);
        setPendingCreditLoading(false);
      });
  }, [refreshTrigger, year]);`;

const r_useEffect = `  const activeCreditCards = useMemo(() => toArray(appData?.bankAccounts).filter(b => normalizeCardType(b.cardType) === "credit" && isActiveBankAccount(b.status)), [appData?.bankAccounts]);

  useEffect(() => {
    setPendingCreditLoading(true);
    setPendingCreditError(false);
    fetch("/api/card-pending-transactions/all", { cache: "no-store" })
      .then(res => res.json())
      .then(pendingRes => {
        const items = dedupePendingItems(pendingRes?.data || []).filter((item: any) => item.status === "pending" || item.status !== "paid");
        const byCard = items.reduce((result: Record<string, any>, item: any) => {
          const id = String(pendingBankAccountId(item) || "unlinked");
          const current = result[id] || { id, total: 0, count: 0, items: [] };
          current.total += Number(item.amount || 0);
          current.count += 1;
          current.items.push(item);
          result[id] = current;
          return result;
        }, {});
        const summaries = activeCreditCards.map((account: any) => {
          const id = String(account.id);
          const cardData = byCard[id] || { total: 0, count: 0, items: [] };
          return { id, account, total: cardData.total, count: cardData.count, items: cardData.items };
        });
        if (byCard["unlinked"]) {
           summaries.push({ id: "unlinked", account: null, total: byCard["unlinked"].total, count: byCard["unlinked"].count, items: byCard["unlinked"].items });
        }
        summaries.sort((a: any, b: any) => {
           if (a.total !== b.total) return b.total - a.total;
           const nameA = a.account ? getPendingCardDisplayName(a.account) : "Z";
           const nameB = b.account ? getPendingCardDisplayName(b.account) : "Z";
           return nameA.localeCompare(nameB);
        });
        const total = summaries.reduce((sum: number, item: any) => sum + Number(item.total || 0), 0);
        setPendingCredit(total);
        setPendingCreditSummaries(summaries);
        setPendingCreditLoading(false);
      })
      .catch(() => {
        setPendingCreditError(true);
        setPendingCredit(0);
        setPendingCreditSummaries([]);
        setPendingCreditLoading(false);
      });
  }, [refreshTrigger, year, activeCreditCards]);`;

const t_box = `    {subTab === "all" && (pendingCredit > 0 || toArray(appData?.bankAccounts).some(b => (b.cardType === "credit" || b.cardType === "Thẻ tín dụng") && (b.status === "active" || b.status === "Đang dùng" || b.status === "enabled"))) && (
      <button type="button" onClick={() => setShowCreditPendingSheet(true)} className="mb-3 block w-full rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-left text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)] active:scale-[0.99] transition-transform">
        <div className="flex justify-between items-center mb-1">
          <p className="text-[12px] font-medium text-[#6B5E64]">Thẻ tín dụng</p>
          <div className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-[#800020]"><svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></div>
        </div>
        <div className="mb-1">
          {pendingCreditLoading ? (
             <p className="text-[20px] font-bold text-[#E11D48]">Đang tải...</p>
          ) : (
             <b className="block break-words text-[22px] font-bold leading-[1.1] tracking-tight text-[#E11D48]">{pendingCredit.toLocaleString("vi-VN")} đ</b>
          )}
        </div>
        {!pendingCreditLoading && (
          pendingCreditSummaries.length > 0 ? (
            <div className="space-y-0.5 mt-1">
              {pendingCreditSummaries.slice(0, 2).map((summary, idx) => {
                const uniqueMonths = Array.from(new Set(summary.items.map((i: any) => new Date(i.date).getMonth() + 1))).sort((a, b) => Number(a) - Number(b));
                const monthText = uniqueMonths.length > 1 ? \`Nhiều kỳ\` : \`Tháng \${uniqueMonths[0]}\`;
                const dueText = summary.account && summary.account.dueDay ? \`hạn \${summary.account.dueDay}\` : "";
                const dueColor = summary.account ? getDueDayColor(summary.account.dueDay, new Date()) : "text-[#6B5E64]";
                const cardName = summary.account ? getPendingCardDisplayName(summary.account) : "Thẻ tín dụng";
                return (
                  <div key={idx} className="flex justify-between items-center text-[11px] leading-[16px]">
                    <span className="text-[#6B5E64] truncate pr-1">{cardName} • {monthText}</span>
                    <span className={\`font-semibold shrink-0 \${dueColor}\`}>{Number(summary.total).toLocaleString("vi-VN")} đ {dueText && \`• \${dueText}\`}</span>
                  </div>
                );
              })}
              {pendingCreditSummaries.length > 2 && (
                 <div className="text-[11px] leading-[16px] text-[#6B5E64] font-medium mt-0.5">+{pendingCreditSummaries.length - 2} thẻ khác</div>
              )}
            </div>
          ) : (
            <p className="text-[11px] font-medium text-[#6B5E64]">Không có dư nợ tạm tính</p>
          )
        )}
      </button>
    )}`;

const r_box = `    {subTab === "all" && activeCreditCards.length > 0 && (
      <button type="button" onClick={() => setShowCreditPendingSheet(true)} className="mb-3 block w-full rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-left text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)] active:scale-[0.99] transition-transform">
        <div className="flex justify-between items-center mb-2">
          <p className="text-[13px] font-medium text-[#6B5E64]">Thẻ tín dụng</p>
          <div className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-[#800020]"><svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></div>
        </div>
        
        {pendingCreditLoading ? (
           <p className="text-[14px] font-bold text-[#E11D48] mb-1">Đang tải...</p>
        ) : (
          <>
            <div className="space-y-1">
              {pendingCreditSummaries.map((summary, idx) => {
                const dueText = summary.account && summary.account.dueDay ? \`hạn \${summary.account.dueDay}\` : "";
                const dueColor = summary.account ? getDueDayColor(summary.account.dueDay, new Date()) : "text-[#6B5E64]";
                const cardName = summary.account ? getPendingCardDisplayName(summary.account) : "Thẻ tín dụng";
                return (
                  <div key={idx} className="flex justify-between items-center text-[12px] leading-[18px]">
                    <span className="text-[#6B5E64] truncate pr-1">{cardName}</span>
                    <span className={\`shrink-0 \${summary.total > 0 ? "font-semibold" : ""}\`}>
                      <span className={summary.total > 0 ? "text-[#E11D48]" : "text-[#6B5E64]"}>{Number(summary.total).toLocaleString("vi-VN")} đ</span>
                      {dueText && summary.total > 0 && <span className={\`ml-1 \${dueColor}\`}>• {dueText}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            {pendingCredit > 0 && (
               <div className="mt-2 pt-2 border-t border-[#E8DCD5]/50 flex justify-between items-center text-[12px]">
                 <span className="font-medium text-[#6B5E64]">Tổng tạm tính:</span>
                 <b className="text-[16px] text-[#E11D48]">{pendingCredit.toLocaleString("vi-VN")} đ</b>
               </div>
            )}
          </>
        )}
      </button>
    )}`;

const t_call = `{showCreditPendingSheet && <CreditPendingSheet close={() => setShowCreditPendingSheet(false)} bankAccounts={appData?.bankAccounts || []} />}`;
const r_call = `{showCreditPendingSheet && <CreditPendingSheet close={() => setShowCreditPendingSheet(false)} summaries={pendingCreditSummaries} refresh={refresh} />}`;

const t_sheet = `export function CreditPendingSheet({ close, bankAccounts }: { close: () => void, bankAccounts: any[] }) {
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

  const activeCreditCards = bankAccounts.filter(b => normalizeCardType(b.cardType) === "credit" && isActiveBankAccount(b.status));
  
  const groups = data.reduce((acc, item) => {
    const id = pendingBankAccountId(item) || "unlinked";
    if (!acc[id]) acc[id] = [];
    acc[id].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  if (payingCard) {
    const total = groups[payingCard] ? groups[payingCard].reduce((sum: number, item: any) => sum + Number(item.amount), 0) : 0;
    const bankAccount = bankAccounts.find(b => String(b.id) === payingCard) || null;
    const cardName = bankAccount ? getPendingCardDisplayName(bankAccount) : "Thẻ chưa liên kết";
    return <CreditPaymentForm card={{ id: payingCard, cardName, total }} bankAccounts={bankAccounts} close={() => setPayingCard(null)} onPaid={() => { setPayingCard(null); load(); }} />;
  }

  let displayedCards: any[] = [];
  if (activeTab === "all") {
    displayedCards = activeCreditCards.map(account => {
       const id = String(account.id);
       const items = groups[id] ? groups[id].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
       const total = items.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
       return { id, cardName: getPendingCardDisplayName(account), total, items, bankAccount: account, hasLinkedCard: true };
    });
    if (groups["unlinked"]) {
       const items = groups["unlinked"].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
       const total = items.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
       const firstItem = items[0] || {};
       const cardName = pendingCardName(firstItem) || "Thẻ chưa liên kết";
       displayedCards.push({ id: "unlinked", cardName, total, items, bankAccount: null, hasLinkedCard: false });
    }
    displayedCards.sort((a, b) => b.total - a.total || a.cardName.localeCompare(b.cardName));
  } else {
    const bankAccount = activeCreditCards.find(b => String(b.id) === activeTab);
    const id = activeTab;
    const items = groups[id] ? groups[id].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
    const total = items.reduce((sum: number, item: any) => sum + Number(item.amount), 0);
    const cardName = bankAccount ? getPendingCardDisplayName(bankAccount) : "Thẻ tín dụng";
    displayedCards = [{ id, cardName, total, items, bankAccount, hasLinkedCard: true }];
  }

  return (
    <FullScreenMobileSheet close={close}>
      <div className="flex flex-col border-b border-[var(--app-border)] bg-[var(--app-nav)] sticky top-0 z-10">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-[16px] font-bold">Tạm tính thẻ tín dụng</h2>
          <button onClick={close} className="rounded-full bg-slate-100 p-2 dark:bg-white/10 text-slate-500 hover:text-black dark:hover:text-white"><svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="flex overflow-x-auto px-4 pb-2 gap-x-2 scrollbar-hide whitespace-nowrap">
          <button onClick={() => setActiveTab("all")} className={\`px-3 py-1.5 rounded-full whitespace-nowrap text-[13px] font-medium transition-colors shrink-0 \${activeTab === "all" ? "bg-[#800020] text-white" : "bg-[#F8F5F2] text-[#6B5E64]"}\`}>Tất cả</button>
          {activeCreditCards.map(b => (
            <button key={b.id} onClick={() => setActiveTab(String(b.id))} className={\`px-3 py-1.5 rounded-full whitespace-nowrap text-[13px] font-medium transition-colors shrink-0 \${activeTab === String(b.id) ? "bg-[#800020] text-white" : "bg-[#F8F5F2] text-[#6B5E64]"}\`}>
              {getPendingCardDisplayName(b)}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-4">
        {loading ? <div className="text-center text-[13px] py-10 text-[#6B5E64]">Đang tải...</div> : (displayedCards.length === 0) ? <div className="text-center text-[13px] py-10 text-[#6B5E64]">Chưa có thẻ tín dụng nào.</div> : displayedCards.map(card => (
          <div key={card.id} className="bg-[var(--app-card)] rounded-[20px] shadow-sm border border-[var(--app-border)] p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-[15px] text-[#171018] dark:text-white">{card.cardName}</h3>
              <b className="text-[15px] text-[#E11D48]">{card.total.toLocaleString("vi-VN")} đ</b>
            </div>
            {card.items.length === 0 ? (
               <div className="text-[13px] text-[#6B5E64] italic text-center py-4 bg-[#F8E7EC]/30 rounded-xl mb-4">Thẻ này chưa có khoản tạm tính.</div>
            ) : (
              <div className="divide-y divide-[#E8DCD5] dark:divide-white/10 bg-[#F8E7EC]/50 dark:bg-black/20 rounded-xl mb-4">
                {card.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center p-2.5 text-[12px]">
                    <div className="min-w-0">
                      <b className="block truncate text-[13px]">{item.title}</b>
                      <span className="text-[#6B5E64] block truncate text-[12px]">{item.date} • {item.category}</span>
                    </div>
                    <b className="shrink-0">{Number(item.amount).toLocaleString("vi-VN")} đ</b>
                  </div>
                ))}
              </div>
            )}
            {card.hasLinkedCard && card.total > 0 && <button onClick={() => setPayingCard(card.id)} className="w-full rounded-xl bg-[#800020] px-4 py-2.5 text-[14px] font-bold text-white active:scale-95 transition-transform">
              Thanh toán thẻ
            </button>}
          </div>
        ))}
      </div>
    </FullScreenMobileSheet>
  );
}`;

const r_sheet = `export function CreditPendingSheet({ close, summaries, refresh }: { close: () => void, summaries: any[], refresh: () => void }) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [payingCard, setPayingCard] = useState<string | null>(null);

  useEffect(() => {
    console.log("creditCards", summaries.filter(s => s.account).map(s => s.account));
    console.log("pendingItems", summaries.flatMap(s => s.items));
  }, [summaries]);

  const activeCreditCards = summaries.filter(s => s.account).map(s => s.account);

  if (payingCard) {
    const summary = summaries.find(s => String(s.id) === String(payingCard));
    if (!summary) return null;
    const cardName = summary.account ? getPendingCardDisplayName(summary.account) : "Thẻ chưa liên kết";
    return <CreditPaymentForm card={{ id: payingCard, cardName, total: summary.total }} bankAccounts={activeCreditCards} close={() => setPayingCard(null)} onPaid={() => { setPayingCard(null); refresh(); close(); }} />;
  }

  const displayedCards = activeTab === "all" ? summaries : summaries.filter(s => String(s.id) === activeTab);

  return (
    <FullScreenMobileSheet close={close}>
      <div className="flex flex-col border-b border-[var(--app-border)] bg-[var(--app-nav)] sticky top-0 z-10">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-[16px] font-bold text-[#171018] dark:text-white">Tạm tính thẻ tín dụng</h2>
          <button onClick={close} className="rounded-full bg-slate-100 p-2 dark:bg-white/10 text-slate-500 hover:text-black dark:hover:text-white"><svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="flex overflow-x-auto px-4 pb-2 gap-x-2 scrollbar-hide whitespace-nowrap">
          <button onClick={() => setActiveTab("all")} className={\`px-3 py-1.5 rounded-full whitespace-nowrap text-[13px] font-medium transition-colors shrink-0 \${activeTab === "all" ? "bg-[#800020] text-white" : "bg-[#F8F5F2] text-[#6B5E64]"}\`}>Tất cả</button>
          {activeCreditCards.map(b => (
            <button key={b.id} onClick={() => setActiveTab(String(b.id))} className={\`px-3 py-1.5 rounded-full whitespace-nowrap text-[13px] font-medium transition-colors shrink-0 \${activeTab === String(b.id) ? "bg-[#800020] text-white" : "bg-[#F8F5F2] text-[#6B5E64]"}\`}>
              {getPendingCardDisplayName(b)}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-4">
        {displayedCards.length === 0 ? <div className="text-center text-[13px] py-10 text-[#6B5E64]">Chưa có thẻ tín dụng nào.</div> : displayedCards.map(card => {
          const cardName = card.account ? getPendingCardDisplayName(card.account) : "Thẻ chưa liên kết";
          const hasLinkedCard = Boolean(card.account);
          return (
          <div key={card.id} className="bg-[var(--app-card)] rounded-[20px] shadow-sm border border-[var(--app-border)] p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-[14px] md:text-[15px] text-[#171018] dark:text-white">{cardName}</h3>
              <b className="text-[14px] md:text-[15px] text-[#E11D48]">{card.total.toLocaleString("vi-VN")} đ</b>
            </div>
            {card.items.length === 0 ? (
               <div className="text-[13px] text-[#6B5E64] italic text-center py-4 bg-[#F8E7EC]/30 rounded-xl mb-4">Thẻ này chưa có khoản tạm tính.</div>
            ) : (
              <div className="divide-y divide-[#E8DCD5] dark:divide-white/10 bg-[#F8E7EC]/50 dark:bg-black/20 rounded-xl mb-4">
                {card.items.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center p-2.5 text-[12px]">
                    <div className="min-w-0">
                      <b className="block truncate text-[13px]">{item.title}</b>
                      <span className="text-[#6B5E64] block truncate text-[12px]">{item.date} • {item.category}</span>
                    </div>
                    <b className="shrink-0">{Number(item.amount).toLocaleString("vi-VN")} đ</b>
                  </div>
                ))}
              </div>
            )}
            {hasLinkedCard && card.total > 0 && <button onClick={() => setPayingCard(card.id)} className="w-full rounded-xl bg-[#800020] px-4 py-2.5 text-[14px] font-bold text-white active:scale-95 transition-transform">
              Thanh toán thẻ
            </button>}
          </div>
        )})}
      </div>
    </FullScreenMobileSheet>
  );
}`;

if (!content.includes(t0)) { console.log("t0 not found"); }
if (!content.includes(t_useEffect)) { console.log("t_useEffect not found"); }
if (!content.includes(t_box)) { console.log("t_box not found"); }
if (!content.includes(t_call)) { console.log("t_call not found"); }
if (!content.includes(t_sheet)) { console.log("t_sheet not found"); }

content = content.replace(t0, r0);
content = content.replace(t_useEffect, r_useEffect);
content = content.replace(t_box, r_box);
content = content.replace(t_call, r_call);
content = content.replace(t_sheet, r_sheet);

fs.writeFileSync(file, content);
console.log("Done");
