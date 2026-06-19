import { readFileSync, writeFileSync } from "fs";

const file = "src/components/timetree-calendar.tsx";
let src = readFileSync(file, "utf8");
const srcLF = src.replace(/\r\n/g, "\n");
let result = srcLF;

// ================================================================
// PATCH 1: Remove pb-[72px] from MobileCalendarView outer wrapper
// (FAB is fixed-positioned so no need for padding)
// ================================================================
const p1old = `    <div className="flex flex-col h-full bg-white dark:bg-slate-950 pb-[72px]">`;
const p1new = `    <div className="flex flex-col h-full bg-white dark:bg-slate-950">`;

if (!result.includes(p1old)) {
  console.error("PATCH 1 not found!");
  process.exit(1);
}
result = result.replace(p1old, p1new);
console.log("Patch 1 OK: removed pb-[72px]");

// ================================================================
// PATCH 2: Fix the inner content container
// Change from: flex-1 overflow-y-auto (which lets month scroll/expand)
// To: flex-1 overflow-hidden flex flex-col
// This makes the month tab fill remaining height properly
// ================================================================
const p2old = `      <div className="flex-1 overflow-y-auto">
        {mobileTab === "month" && (
          <div className="flex flex-col">

            {/* Calendar Grid */}
            <div className="w-full bg-white dark:bg-slate-950">`;

const p2new = `      <div className="flex-1 overflow-hidden flex flex-col">
        {mobileTab === "month" && (
          <div className="flex flex-col flex-1 min-h-0">

            {/* Calendar Grid */}
            <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-950">`;

if (!result.includes(p2old)) {
  console.error("PATCH 2 not found!");
  const idx = result.indexOf('overflow-y-auto">');
  if (idx >= 0) console.log("Context:", JSON.stringify(result.substring(idx - 20, idx + 200)));
  process.exit(1);
}
result = result.replace(p2old, p2new);
console.log("Patch 2 OK: fixed content container");

// ================================================================
// PATCH 3: Make the day-of-week header not shrink
// ================================================================
const p3old = `              <div className="grid grid-cols-7 border-b border-slate-100 dark:border-white/5">
                {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day, i) => (
                  <div key={day} className={\`text-center text-[9px] py-1 font-bold uppercase tracking-wider \${i === 0 ? "text-red-500" : "text-slate-400"}\`}>{day}</div>
                ))}
              </div>`;

const p3new = `              <div className="grid grid-cols-7 border-b border-slate-100 dark:border-white/5 shrink-0">
                {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day, i) => (
                  <div key={day} className={\`text-center text-[9px] py-1 font-bold uppercase tracking-wider \${i === 0 ? "text-red-500" : "text-slate-400"}\`}>{day}</div>
                ))}
              </div>`;

if (!result.includes(p3old)) {
  console.error("PATCH 3 not found!");
  process.exit(1);
}
result = result.replace(p3old, p3new);
console.log("Patch 3 OK: header shrink-0");

// ================================================================
// PATCH 4: Make the grid fill remaining height with grid-rows-6
// Remove fixed h-[12vh] max-h min-h on cells, use flex-1 rows
// The grid itself: flex-1, grid-cols-7 grid-rows-6
// Each cell: no fixed height, just fill
// ================================================================
const p4old = `              <div className="grid grid-cols-7">
                {monthCells(anchor).map((date, index) => {
                  const dateIso = iso(date);
                  const isSelected = selectedDate === dateIso;
                  const dayEvents = visibleEvents.filter((e: any) => e.startDate === dateIso).sort((a: any, b: any) => a.title.localeCompare(b.title));
                  const isCurrentMonth = date.getMonth() === anchor.getMonth();
                  const isSunday = date.getDay() === 0;
                  const isLastCol = index % 7 === 6;
                  const lunarInfo = getLunarSafe(dateIso);
                  return (
                    <div 
                      key={dateIso} 
                      onClick={() => { pickDate(dateIso); setMobileTab("day"); }}
                      className={\`flex flex-col border-b border-slate-100 dark:border-white/5 h-[12vh] max-h-[80px] min-h-[50px] overflow-hidden cursor-pointer \${!isLastCol ? "border-r" : ""} \${!isCurrentMonth ? "bg-slate-50/50 dark:bg-white/[0.01]" : ""} \${isSelected ? "bg-indigo-50/20 dark:bg-indigo-500/10" : ""}\`}
                    >`;

const p4new = `              <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0">
                {monthCells(anchor).map((date, index) => {
                  const dateIso = iso(date);
                  const isSelected = selectedDate === dateIso;
                  const dayEvents = visibleEvents.filter((e: any) => e.startDate === dateIso).sort((a: any, b: any) => a.title.localeCompare(b.title));
                  const isCurrentMonth = date.getMonth() === anchor.getMonth();
                  const isSunday = date.getDay() === 0;
                  const isLastCol = index % 7 === 6;
                  const lunarInfo = getLunarSafe(dateIso);
                  return (
                    <div 
                      key={dateIso} 
                      onClick={() => { pickDate(dateIso); setMobileTab("day"); }}
                      className={\`flex flex-col border-b border-slate-100 dark:border-white/5 overflow-hidden cursor-pointer \${!isLastCol ? "border-r" : ""} \${!isCurrentMonth ? "bg-slate-50/50 dark:bg-white/[0.01]" : ""} \${isSelected ? "bg-indigo-50/20 dark:bg-indigo-500/10" : ""}\`}
                    >`;

if (!result.includes(p4old)) {
  console.error("PATCH 4 not found!");
  process.exit(1);
}
result = result.replace(p4old, p4new);
console.log("Patch 4 OK: grid fills height");

// ================================================================
// PATCH 5: Close the month tab properly — fix the extra empty divs
// The old structure had:
//   </div> (grid)
//   </div> (w-full bg-white)
//   (blank line)
//   (blank line)
//   </div> (flex flex-col — month outer)
// New structure needs all these closed but no extra wrapper
// ================================================================
const p5old = `              </div>
            </div>


          </div>
        )}

        {mobileTab === "week" && (`;

const p5new = `              </div>
            </div>
          </div>
        )}

        {mobileTab === "week" && (`;

if (!result.includes(p5old)) {
  console.error("PATCH 5 not found!");
  process.exit(1);
}
result = result.replace(p5old, p5new);
console.log("Patch 5 OK: cleaned closing divs");

// ================================================================
// PATCH 6: week/day/list tabs — make them render correctly inside
// the flex-col container (they need to handle overflow themselves)
// The week tab currently has h-full which won't work without proper parent
// Fix: add min-h-0 and make them self-scrolling
// ================================================================
const p6old = `        {mobileTab === "week" && (
          <div className="flex flex-col flex-1 h-full bg-white dark:bg-slate-950">`;
const p6new = `        {mobileTab === "week" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-white dark:bg-slate-950">`;

if (!result.includes(p6old)) {
  console.error("PATCH 6 not found!");
  process.exit(1);
}
result = result.replace(p6old, p6new);
console.log("Patch 6 OK: week tab scrollable");

const p7old = `        {mobileTab === "day" && (
          <div className="flex flex-col flex-1 h-full bg-[#f8fafc] dark:bg-slate-950">`;
const p7new = `        {mobileTab === "day" && (
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-[#f8fafc] dark:bg-slate-950">`;

if (!result.includes(p7old)) {
  console.error("PATCH 7 not found!");
  process.exit(1);
}
result = result.replace(p7old, p7new);
console.log("Patch 7 OK: day tab scrollable");

const p8old = `        {mobileTab === "list" && (
          <div className="min-h-full bg-[#f8fafc]">`;
const p8new = `        {mobileTab === "list" && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-[#f8fafc]">`;

if (!result.includes(p8old)) {
  console.error("PATCH 8 not found!");
  process.exit(1);
}
result = result.replace(p8old, p8new);
console.log("Patch 8 OK: list tab scrollable");

// Restore CRLF
result = result.replace(/\n/g, "\r\n");
writeFileSync(file, result, "utf8");
console.log("\nAll patches applied successfully!");
