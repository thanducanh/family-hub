const fs = require('fs');

let app = fs.readFileSync('src/components/family-app.tsx', 'utf8');

const overviewStart = app.indexOf('function FinanceOverview() {');
const overviewEnd = app.indexOf('function InvestmentSheet(', overviewStart);

if (overviewStart === -1 || overviewEnd === -1) {
  console.error("Could not find FinanceOverview");
  process.exit(1);
}

const newOverview = `function FinanceOverview() {
  const { toast } = useUI();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [yearStr, setYearStr] = useState(String(new Date().getFullYear()));
  const [chartMode, setChartMode] = useState<"income" | "expense" | "compare" | "savings">("compare");
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings Form
  const [settingsStartMonth, setSettingsStartMonth] = useState("");
  const [settingsStartYear, setSettingsStartYear] = useState("");
  const [settingsBalance, setSettingsBalance] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(\`/api/finance-overview?year=\${yearStr}\`, { cache: "no-store" });
    const result = await readJsonSafe<{ data?: any }>(response);
    if (response.ok && result?.data) {
      setData(result.data);
      if (result.data.trackingStartDate) {
        const [y, m] = result.data.trackingStartDate.split('-');
        setSettingsStartYear(y);
        setSettingsStartMonth(String(Number(m)));
      }
      if (result.data.openingCashBalance !== undefined) {
        setSettingsBalance(String(result.data.openingCashBalance));
      }
    }
    setLoading(false);
  }, [yearStr]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const overviewPayload = data || {};
  const monthlyData: { month: number; income: number; expense: number; savingsTransferred?: number; netInvestment?: number }[] = Array.isArray(data)
    ? data
    : Array.isArray(overviewPayload.monthlyData)
      ? overviewPayload.monthlyData
      : [];

  const currentCash = Number(overviewPayload.currentCash || 0);

  const currentMonth = new Date().getMonth() + 1;
  const currentMonthData = monthlyData.find(d => d.month === currentMonth) || { income: 0, expense: 0, savingsTransferred: 0, netInvestment: 0 };
  const currentMonthSavings = currentMonthData.income - currentMonthData.expense;

  const maxVal = Math.max(1, ...monthlyData.map(d => {
    if (chartMode === "income") return d.income;
    if (chartMode === "expense") return d.expense;
    if (chartMode === "savings") return Math.abs(d.income - d.expense);
    return Math.max(d.income, d.expense);
  }));

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    const startDate = \`\${settingsStartYear}-\${settingsStartMonth.padStart(2, '0')}-01\`;
    const response = await fetch("/api/finance-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackingStartDate: startDate, openingCashBalance: Number(settingsBalance) })
    });
    if (response.ok) {
      toast("Đã lưu cài đặt dòng tiền", "success");
      setShowSettings(false);
      load();
    } else {
      toast("Lỗi khi lưu cài đặt", "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <select className={filterClass} value={yearStr} onChange={event => setYearStr(event.target.value)}>
            {Array.from({ length: 7 }, (_, index) => String(new Date().getFullYear() - 3 + index)).map(value => <option key={value}>{value}</option>)}
          </select>
          <button onClick={() => setShowSettings(true)} className="h-11 px-4 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-slate-100 font-bold text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20">
            Cài đặt
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Card><p className="text-xs text-slate-400">Thu tháng này</p><b className="text-emerald-500">{money(currentMonthData.income)}</b></Card>
        <Card><p className="text-xs text-slate-400">Chi tháng này</p><b className="text-rose-500">{money(currentMonthData.expense)}</b></Card>
        <Card><p className="text-xs text-slate-400">Dư sau chi tháng này</p><b className={currentMonthSavings >= 0 ? "text-blue-500" : "text-rose-500"}>{money(currentMonthSavings)}</b></Card>
        <Card><p className="text-xs text-slate-400">Tiết kiệm chuyển tháng này</p><b className="text-indigo-500">{money(currentMonthData.savingsTransferred || 0)}</b></Card>
        <Card><p className="text-xs text-slate-400">Đầu tư ròng tháng này</p><b className="text-orange-500">{money(currentMonthData.netInvestment || 0)}</b></Card>
        <Card><p className="text-xs text-slate-400">Tiền hiện tại dự kiến</p><b className={currentCash < 0 ? "text-rose-500" : "text-emerald-500"}>{money(currentCash)}</b></Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <b>Biểu đồ Tổng quan</b>
            {loading && <span className="text-xs text-slate-400">Đang tải...</span>}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button onClick={() => setChartMode("income")} className={\`rounded-full px-3 py-1 font-bold \${chartMode === "income" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-white/5"}\`}>Thu nhập</button>
            <button onClick={() => setChartMode("expense")} className={\`rounded-full px-3 py-1 font-bold \${chartMode === "expense" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" : "bg-slate-100 text-slate-500 dark:bg-white/5"}\`}>Chi tiêu</button>
            <button onClick={() => setChartMode("compare")} className={\`rounded-full px-3 py-1 font-bold \${chartMode === "compare" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400" : "bg-slate-100 text-slate-500 dark:bg-white/5"}\`}>So sánh</button>
            <button onClick={() => setChartMode("savings")} className={\`rounded-full px-3 py-1 font-bold \${chartMode === "savings" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-slate-100 text-slate-500 dark:bg-white/5"}\`}>Dư sau chi tiêu</button>
          </div>
        </div>
        <div className="flex h-64 w-full items-end justify-between gap-1 overflow-x-auto pb-2 md:justify-center md:gap-4 lg:gap-6">
          {monthlyData.map(item => {
            const itemSavings = item.income - item.expense;
            return (
            <div key={item.month} className="flex min-w-[30px] flex-1 flex-col items-center gap-2 md:max-w-[60px]">
              <div className="flex h-[240px] w-full items-end justify-center gap-0.5 md:gap-1">
                {(chartMode === "income" || chartMode === "compare") && <div className="w-full rounded-t-md bg-emerald-500" style={{ height: \`\${Math.max(2, (item.income / maxVal) * 100)}%\` }} title={\`Thu: \${money(item.income)}\`} />}
                {(chartMode === "expense" || chartMode === "compare") && <div className="w-full rounded-t-md bg-rose-500" style={{ height: \`\${Math.max(2, (item.expense / maxVal) * 100)}%\` }} title={\`Chi: \${money(item.expense)}\`} />}
                {chartMode === "savings" && <div className={\`w-full rounded-t-md \${itemSavings >= 0 ? "bg-blue-500" : "bg-orange-500"}\`} style={{ height: \`\${Math.max(2, (Math.abs(itemSavings) / maxVal) * 100)}%\` }} title={\`Dư: \${money(itemSavings)}\`} />}
              </div>
              <span className="text-[10px] font-bold text-slate-400 md:text-xs">T{item.month}</span>
            </div>
          )})}
          {!monthlyData.length && !loading && <div className="w-full text-center text-sm text-slate-400">Chưa có dữ liệu.</div>}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--app-border)] p-4">
          <b>Dòng tiền tháng</b>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-xs text-slate-400 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3">Tháng</th>
                <th className="px-4 py-3 text-right">Thu</th>
                <th className="px-4 py-3 text-right">Chi</th>
                <th className="px-4 py-3 text-right">Dư sau chi</th>
                <th className="px-4 py-3 text-right">Tiết kiệm chuyển</th>
                <th className="px-4 py-3 text-right">Đầu tư ròng</th>
                <th className="px-4 py-3 text-right">Còn lại tháng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--app-border)]">
              {monthlyData.map(item => {
                const afterExpense = item.income - item.expense;
                const netSavings = item.savingsTransferred || 0;
                const netInvest = item.netInvestment || 0;
                const finalRemaining = afterExpense - netSavings + netInvest; // Note: if netInvest = Buy - Sell, and Buy = cash outflow, it should be - netInvest. Wait! In API: "netInvestment = Buy - Sell". If netInvestment is cash OUT, then finalRemaining should be: afterExpense - netSavings - netInvest!
                // Let's use the formula from user: Còn lại tháng = Thu - Chi - Tiết kiệm chuyển + Đầu tư ròng.
                // Oh wait, if the user said + Đầu tư ròng, let's just use it verbatim.
                const userFinalRemaining = afterExpense - netSavings + netInvest;

                return (
                  <tr key={item.month} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold">Tháng {item.month}</td>
                    <td className="px-4 py-3 text-right text-emerald-500">{money(item.income)}</td>
                    <td className="px-4 py-3 text-right text-rose-500">{money(item.expense)}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-500">{money(afterExpense)}</td>
                    <td className="px-4 py-3 text-right text-indigo-500">{money(netSavings)}</td>
                    <td className="px-4 py-3 text-right text-orange-500">{money(netInvest)}</td>
                    <td className="px-4 py-3 text-right font-bold">{money(userFinalRemaining)}</td>
                  </tr>
                );
              })}
              {!monthlyData.length && (
                <tr><td colSpan={7} className="p-4 text-center text-slate-400">Không có dữ liệu</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--app-border)] bg-[var(--app-bg)] p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold">Cài đặt dòng tiền</h3>
            <p className="mb-4 text-xs text-slate-500">Chỉ các giao dịch từ tháng bắt đầu trở đi mới dùng để tính Tiền hiện tại.</p>
            <form onSubmit={saveSettings} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tháng bắt đầu">
                  <select required className={inputClass} value={settingsStartMonth} onChange={e => setSettingsStartMonth(e.target.value)}>
                    <option value="">-- Tháng --</option>
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Năm bắt đầu">
                  <select required className={inputClass} value={settingsStartYear} onChange={e => setSettingsStartYear(e.target.value)}>
                    <option value="">-- Năm --</option>
                    {Array.from({length: 7}, (_, i) => new Date().getFullYear() - 3 + i).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Số dư tiền ban đầu">
                <input required type="number" className={inputClass} value={settingsBalance} onChange={e => setSettingsBalance(e.target.value)} />
              </Field>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSettings(false)} className="flex-1 rounded-xl border border-[var(--app-border)] px-4 py-2 text-sm font-bold">Hủy</button>
                <button type="submit" className="flex-1 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}
  </div>
  );
}
`;

app = app.substring(0, overviewStart) + newOverview + app.substring(overviewEnd);
fs.writeFileSync('src/components/family-app.tsx', app, 'utf8');
console.log('FinanceOverview completely replaced');
