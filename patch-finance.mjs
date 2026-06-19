import { readFileSync, writeFileSync } from "fs";

const file = "src/components/family-app.tsx";
let src = readFileSync(file, "utf8");
// Normalize line endings to LF for consistent replacement
const lfSrc = src.replace(/\r\n/g, "\n");
let result = lfSrc;

// PATCH 1: Fix pb-[100px] on main
const p1old = 'return <main className={`min-h-screen bg-[var(--app-background)] text-[var(--app-foreground)] transition-[padding-left] duration-300 ${screen === "calendar" ? "pb-0" : "pb-[100px] md:pb-0"} ${sidebarCollapsed ? "md:pl-[64px]" : "md:pl-[220px]"}`}>';
const p1new = 'return <main className={`min-h-screen bg-[var(--app-background)] text-[var(--app-foreground)] transition-[padding-left] duration-300 ${screen === "calendar" || screen === "finance" ? "pb-0" : "pb-[100px] md:pb-0"} ${sidebarCollapsed ? "md:pl-[64px]" : "md:pl-[220px]"}`}>';
if (!result.includes(p1old)) { console.error("PATCH 1 not found!"); process.exit(1); }
result = result.replace(p1old, p1new);

// PATCH 2: Hide global header for finance on mobile
const p2old = '<header className={`sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-nav)] px-3 py-2 backdrop-blur md:px-6 md:py-3 ${screen === "calendar" || screen === "members" ? "hidden md:block" : "block"}`}>';
const p2new = '<header className={`sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-nav)] px-3 py-2 backdrop-blur md:px-6 md:py-3 ${screen === "calendar" || screen === "members" || screen === "finance" ? "hidden md:block" : "block"}`}>';
if (!result.includes(p2old)) { console.error("PATCH 2 not found!"); process.exit(1); }
result = result.replace(p2old, p2new);

// PATCH 3: Change MobileFinance root background
const p3old = '<div className="flex flex-col h-[100dvh] bg-[#f0f2f5] dark:bg-[var(--app-bg)] md:hidden font-sans">';
const p3new = '<div className="flex flex-col h-[100dvh] bg-[#003f3a] dark:bg-[#064e46] md:hidden font-sans">';
if (!result.includes(p3old)) { console.error("PATCH 3 not found!"); process.exit(1); }
result = result.replace(p3old, p3new);

// PATCH 4: Redesign transaction row in MobileTransactionList
const p4old = `              {items.map((item: any) => <div key={\`\${item._isIncome ? 'income' : 'expense'}-\${item.id}\`} className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-1">
                <button type="button" onClick={() => setDetail(item)} className="min-w-0 py-2 text-left active:opacity-70">
                  <b className="block truncate text-[15px] leading-5 text-white">{item._displayName}</b>
                  <span className="mt-1 block truncate text-[12px] text-[#cbd5e1]">{item.note || item._displayCategory || "Khác"}</span>
                </button>
                <button type="button" onClick={() => setDetail(item)} className="min-w-0 py-2 text-right active:opacity-70">
                  <b className={\`block whitespace-nowrap text-[14px] \${item._isIncome ? "text-[#22c55e]" : "text-[#fb923c]"}\`}>{item._isIncome ? "+" : "-"}{money(item.amount)}</b>
                  {item._displayTime && <span className="mt-1 block text-[12px] text-white/50">{String(item._displayTime).slice(0, 5)}</span>}
                </button>
                <button type="button" aria-label={\`Tùy chọn \${item._displayName}\`} onClick={(event) => { event.stopPropagation(); setMenuItem(item); }} className="grid size-9 place-items-center rounded-full text-xl font-bold text-white/70 active:bg-white/10">•••</button>
              </div>)}`;

const p4new = `              {items.map((item: any) => <button type="button" onClick={() => setDetail(item)} key={\`\${item._isIncome ? 'income' : 'expense'}-\${item.id}\`} className="flex w-full items-center justify-between gap-3 py-3 active:opacity-70">
                <div className="min-w-0 flex-1 text-left">
                  <b className="block truncate text-[15px] font-semibold text-white">{item._displayName}</b>
                  <span className="mt-0.5 block truncate text-[12px] text-[#cbd5e1]">{item.note || item._displayCategory || "Khác"}</span>
                </div>
                <div className="shrink-0 text-right">
                  <b className={\`block text-[15px] font-bold \${item._isIncome ? "text-[#22c55e]" : "text-[#fb923c]"}\`}>{item._isIncome ? "+" : "-"}{money(item.amount)}</b>
                  {item._displayTime && <span className="mt-0.5 block text-[12px] text-[#cbd5e1]">{String(item._displayTime).slice(0, 5)}</span>}
                </div>
              </button>)}`;

if (!result.includes(p4old)) { console.error("PATCH 4 not found!"); process.exit(1); }
result = result.replace(p4old, p4new);

// Restore CRLF
result = result.replace(/\n/g, "\r\n");
writeFileSync(file, result, "utf8");
console.log("family-app.tsx patched successfully!");
