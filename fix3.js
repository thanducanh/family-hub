const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t1 = `function getPendingCardDisplayName(card: any) {
  const bankName = String(card.bankName || card.bank_name || "").trim();
  const displayName = String(card.displayName || card.display_name || "").trim();
  const productName = String(card.productName || card.product_name || "").trim();

  if (bankName === "HSBC" && displayName === "Live+") return "HSBC Live+";
  
  if (displayName && displayName.toLowerCase().includes(bankName.toLowerCase())) return displayName;
  if (productName && productName.toLowerCase().includes(bankName.toLowerCase())) return productName;

  if (bankName && productName) return \`\${bankName} \${productName}\`.trim();
  if (bankName && displayName) return \`\${bankName} \${displayName}\`.trim();

  return bankName || "Thẻ tín dụng";
}`;

const r1 = `function getPendingCardDisplayName(card: any) {
  const bankName = String(card.bankName || card.bank_name || "").trim();
  const displayName = String(card.displayName || card.display_name || "").trim();
  const productName = String(card.productName || card.product_name || "").trim();

  if (bankName === "HSBC" && displayName === "Live+") return "HSBC Live+";
  if (displayName && displayName.toLowerCase().includes(bankName.toLowerCase())) return displayName;
  if (productName && productName.toLowerCase().includes(bankName.toLowerCase())) return productName;
  if (bankName && displayName) return \`\${bankName} \${displayName}\`.trim();
  if (bankName && productName) return \`\${bankName} \${productName}\`.trim();
  return bankName || "Thẻ tín dụng";
}`;

const t2 = `    {subTab === "all" && (pendingCredit > 0 || toArray(appData?.bankAccounts).some(b => (b.cardType === "credit" || b.cardType === "Thẻ tín dụng") && (b.status === "active" || b.status === "Đang dùng" || b.status === "enabled"))) && (
      <button type="button" onClick={() => setShowCreditPendingSheet(true)} className="mb-3 block w-full rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-left text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)] active:scale-[0.99] transition-transform">
        <div className="flex justify-between items-center mb-1">
          <p className="text-[13px] font-medium text-[#6B5E64]">Thẻ tín dụng / Tạm tính thẻ</p>
          <div className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-[#800020]"><svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></div>
        </div>
        <div className="mb-2">
          {pendingCreditLoading ? (
             <p className="text-[20px] font-bold text-[#E11D48]">Đang tải...</p>
          ) : (
             <b className="block break-words text-[24px] font-bold leading-tight tracking-tight text-[#E11D48]">{pendingCredit.toLocaleString("vi-VN")} đ</b>
          )}
        </div>
        {!pendingCreditLoading && (
          pendingCreditSummaries.length > 0 ? (
            <div className="space-y-1 mt-2">
              {pendingCreditSummaries.map((summary, idx) => {
                const uniqueMonths = Array.from(new Set(summary.items.map((i: any) => new Date(i.date).getMonth() + 1))).sort((a, b) => Number(a) - Number(b));
                const monthText = uniqueMonths.length > 1 ? \`Nhiều kỳ\` : \`Tháng \${uniqueMonths[0]}\`;
                const dueText = summary.account ? getDueDayText(summary.account.dueDay) : "";
                const dueColor = summary.account ? getDueDayColor(summary.account.dueDay, new Date()) : "text-[#6B5E64]";
                const cardName = summary.account ? getPendingCardDisplayName(summary.account) : "Thẻ tín dụng";
                return (
                  <div key={idx} className="flex justify-between items-center text-[13px]">
                    <span className="text-[#6B5E64] truncate">{cardName} • {monthText}</span>
                    <span className={\`font-semibold \${dueColor}\`}>{Number(summary.total).toLocaleString("vi-VN")} đ {dueText && \`• \${dueText}\`}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[13px] font-medium text-[#6B5E64]">Không có dư nợ tạm tính</p>
          )
        )}
      </button>
    )}`;

const r2 = `    {subTab === "all" && (pendingCredit > 0 || toArray(appData?.bankAccounts).some(b => (b.cardType === "credit" || b.cardType === "Thẻ tín dụng") && (b.status === "active" || b.status === "Đang dùng" || b.status === "enabled"))) && (
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

const t3 = `  let displayedCards: any[] = [];
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
    const cardName = bankAccount ? getPendingCardDisplayName(bankAccount) : "Thẻ tín dụng";
    displayedCards = [{ id, cardName, total, items, bankAccount, hasLinkedCard: true }];
  }

  return (
    <FullScreenMobileSheet close={close}>
      <div className="flex flex-col border-b border-[var(--app-border)] bg-[var(--app-nav)] sticky top-0 z-10">
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-[14px] font-bold">Tạm tính thẻ tín dụng</h2>
          <button onClick={close} className="rounded-full bg-slate-100 p-2 dark:bg-white/10 text-slate-500 hover:text-black dark:hover:text-white"><svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="flex overflow-x-auto px-4 pb-2 space-x-2 scrollbar-hide">
          <button onClick={() => setActiveTab("all")} className={\`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium \${activeTab === "all" ? "bg-[#800020] text-white" : "bg-[#F8F5F2] text-[#6B5E64]"}\`}>Tất cả</button>
          {activeCreditCards.map(b => (
            <button key={b.id} onClick={() => setActiveTab(String(b.id))} className={\`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium \${activeTab === String(b.id) ? "bg-[#800020] text-white" : "bg-[#F8F5F2] text-[#6B5E64]"}\`}>
              {getPendingCardDisplayName(b)}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-4">
        {loading ? <div className="text-center text-sm py-10">Đang tải...</div> : (displayedCards.length === 0 || (activeTab !== "all" && displayedCards[0].items.length === 0)) ? <div className="text-center text-sm py-10">{activeTab === "all" ? "Không có khoản tạm tính nào." : "Thẻ này chưa có khoản tạm tính."}</div> : displayedCards.map(card => (
          card.items.length > 0 && <div key={card.id} className="bg-[var(--app-card)] rounded-[20px] shadow-sm border border-[var(--app-border)] p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-[14px] text-[#171018] dark:text-white">{card.cardName}</h3>
              <b className="text-[15px] text-[#E11D48]">{card.total.toLocaleString("vi-VN")} đ</b>
            </div>
            <div className="divide-y divide-[#E8DCD5] dark:divide-white/10 bg-[#F8E7EC]/50 dark:bg-black/20 rounded-xl mb-4">
              {card.items.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center p-2.5 text-[12px]">
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
  );`;

const r3 = `  let displayedCards: any[] = [];
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
  );`;

if (!content.includes(t1)) { console.log("t1 not found"); }
if (!content.includes(t2)) { console.log("t2 not found"); }
if (!content.includes(t3)) { console.log("t3 not found"); }

content = content.replace(t1, r1);
content = content.replace(t2, r2);
content = content.replace(t3, r3);

fs.writeFileSync(file, content);
console.log("Done replacing.");
