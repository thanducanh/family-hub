const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t1 = `  const [editor, setEditor] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;`;

const r1 = `  const [editor, setEditor] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  const [pendingCredit, setPendingCredit] = useState(0);
  const [pendingCreditSummaries, setPendingCreditSummaries] = useState<any[]>([]);
  const [pendingCreditLoading, setPendingCreditLoading] = useState(true);
  const [pendingCreditError, setPendingCreditError] = useState(false);
  const [showCreditPendingSheet, setShowCreditPendingSheet] = useState(false);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth() + 1;

  useEffect(() => {
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

const t2 = `    </div>

    <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
      <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Có thể dùng tháng này</p>`;

const r2 = `    </div>

    {subTab === "all" && (pendingCredit > 0 || toArray(appData?.bankAccounts).some(b => (b.cardType === "credit" || b.cardType === "Thẻ tín dụng") && (b.status === "active" || b.status === "Đang dùng" || b.status === "enabled"))) && (
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
    )}

    <div className="mb-3 rounded-[20px] border border-[#E8DCD5] bg-[var(--mobile-card)] p-4 text-[#171018] shadow-[0_6px_18px_rgba(128,0,32,0.07)]">
      <p className="mb-1 text-[13px] font-medium text-[#6B5E64]">Có thể dùng tháng này</p>`;

const t3 = `          <h2 className="text-lg font-bold">Tạm tính thẻ tín dụng</h2>`;
const r3 = `          <h2 className="text-[14px] font-bold">Tạm tính thẻ tín dụng</h2>`;

const t4 = `              <h3 className="font-bold text-[16px] text-[#171018] dark:text-white">{card.cardName}</h3>
              <b className="text-[16px] text-[#E11D48]">{card.total.toLocaleString("vi-VN")} đ</b>`;
const r4 = `              <h3 className="font-bold text-[14px] text-[#171018] dark:text-white">{card.cardName}</h3>
              <b className="text-[15px] text-[#E11D48]">{card.total.toLocaleString("vi-VN")} đ</b>`;

const t5 = `                <div key={item.id} className="flex justify-between items-center p-3 text-[13px]">
                  <div className="min-w-0">
                    <b className="block truncate">{item.title}</b>
                    <span className="text-[#6B5E64] block truncate">{item.date} • {item.category}</span>
                  </div>`;
const r5 = `                <div key={item.id} className="flex justify-between items-center p-2.5 text-[12px]">
                  <div className="min-w-0">
                    <b className="block truncate">{item.title}</b>
                    <span className="text-[#6B5E64] block truncate">{item.date} • {item.category}</span>
                  </div>`;

if (!content.includes(t1)) { console.log("t1 not found"); }
if (!content.includes(t2)) { console.log("t2 not found"); }

content = content.replace(t1, r1);
content = content.replace(t2, r2);
content = content.replace(t3, r3);
content = content.replace(t4, r4);
content = content.replace(t5, r5);

fs.writeFileSync(file, content);
console.log("Done replacing.");
