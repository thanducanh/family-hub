const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_effect = `  const activeCreditCards = useMemo(() => toArray(appData?.bankAccounts).filter(b => normalizeCardType(b.cardType) === "credit" && isActiveBankAccount(b.status)), [appData?.bankAccounts]);

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

const r_effect = `  const currentMemberId = user?.memberId || user?.member?.id || "";

  useEffect(() => {
    setPendingCreditLoading(true);
    setPendingCreditError(false);
    
    Promise.all([
      fetch(currentMemberId ? \`/api/bank-accounts?memberId=\${encodeURIComponent(currentMemberId)}\` : "/api/bank-accounts", { cache: "no-store" }).then(res => res.json()).catch(() => null),
      fetch(currentMemberId ? \`/api/card-pending-transactions/all?memberId=\${encodeURIComponent(currentMemberId)}\` : "/api/card-pending-transactions/all", { cache: "no-store" }).then(res => res.json()).catch(() => null)
    ]).then(([accountRes, pendingRes]) => {
        const accountRows = Array.isArray(accountRes) ? accountRes : Array.isArray(accountRes?.data) ? accountRes.data : Array.isArray(accountRes?.rows) ? accountRes.rows : [];
        const fetchedCreditCards = accountRows.filter((b: any) => normalizeCardType(b.cardType) === "credit" && isActiveBankAccount(b.status));

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

        const summaries = fetchedCreditCards.map((account: any) => {
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
    }).catch(() => {
        setPendingCreditError(true);
        setPendingCredit(0);
        setPendingCreditSummaries([]);
        setPendingCreditLoading(false);
    });
  }, [refreshTrigger, year, currentMemberId]);`;


const t_box = `    {subTab === "all" && activeCreditCards.length > 0 && (
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

const r_box = `    {(() => {
      const allCreditCards = pendingCreditSummaries.map(s => s.account).filter(Boolean);
      const pendingItems = pendingCreditSummaries.flatMap(s => s.items);
      const shouldShowCreditBox = subTab === "all" && (allCreditCards.length > 0 || pendingItems.length > 0 || pendingCredit > 0 || pendingCreditError);
      
      console.log("[CreditBox] memberId", currentMemberId);
      console.log("[CreditBox] allCreditCards", allCreditCards);
      console.log("[CreditBox] pendingItems", pendingItems);
      console.log("[CreditBox] pendingTotal", pendingCredit);
      console.log("[CreditBox] shouldShowCreditBox", shouldShowCreditBox);

      if (!shouldShowCreditBox) return null;

      return (
        <button type="button" onClick={() => setShowCreditPendingSheet(true)} className="mb-3 block w-full rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-left text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)] active:scale-[0.99] transition-transform">
          <div className="flex justify-between items-center mb-2">
            <p className="text-[13px] font-medium text-[#6B5E64]">Thẻ tín dụng</p>
            <div className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-[#800020]"><svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg></div>
          </div>
          
          {pendingCreditError ? (
            <p className="text-[13px] text-[#6B5E64]">Không tải được dữ liệu thẻ. Bấm để thử lại.</p>
          ) : pendingCreditLoading ? (
             <p className="text-[14px] font-bold text-[#E11D48] mb-1">Đang tải...</p>
          ) : (
            <>
              {pendingCredit > 0 && (
                 <div className="mb-3 pb-2 border-b border-[#E8DCD5]/50 flex justify-between items-center text-[12px]">
                   <span className="font-medium text-[#6B5E64]">Tổng:</span>
                   <b className="text-[16px] text-[#E11D48]">{pendingCredit.toLocaleString("vi-VN")} đ</b>
                 </div>
              )}
              <div className="space-y-1">
                {pendingCreditSummaries.slice(0, 3).map((summary, idx) => {
                  const dueText = summary.account && summary.account.dueDay ? \`hạn \${summary.account.dueDay}\` : "";
                  const dueColor = summary.account ? getDueDayColor(summary.account.dueDay, new Date()) : "text-[#6B5E64]";
                  const cardName = summary.account ? getPendingCardDisplayName(summary.account) : "Thẻ tín dụng";
                  return (
                    <div key={idx} className="flex justify-between items-center text-[12px] leading-[18px]">
                      <span className="text-[#6B5E64] truncate pr-1">{cardName}</span>
                      <span className={\`shrink-0 \${summary.total > 0 ? "font-semibold" : ""}\`}>
                        <span className={summary.total > 0 ? "text-[#E11D48]" : "text-[#6B5E64]"}>{Number(summary.total).toLocaleString("vi-VN")} đ</span>
                        {dueText && <span className={\`ml-1 \${dueColor}\`}>• {dueText}</span>}
                      </span>
                    </div>
                  );
                })}
                {pendingCreditSummaries.length > 3 && (
                   <div className="text-[11px] leading-[16px] text-[#6B5E64] font-medium mt-1">+{pendingCreditSummaries.length - 3} thẻ khác</div>
                )}
              </div>
            </>
          )}
        </button>
      );
    })()}`;

if (!content.includes(t_effect)) { console.log("t_effect not found"); }
if (!content.includes(t_box)) { console.log("t_box not found"); }

content = content.replace(t_effect, r_effect);
content = content.replace(t_box, r_box);

fs.writeFileSync(file, content);
console.log("Done");
