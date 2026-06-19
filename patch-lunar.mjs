import { readFileSync, writeFileSync } from "fs";

const file = "src/components/timetree-calendar.tsx";
let src = readFileSync(file, "utf8");
// Normalize line endings to LF
const lfSrc = src.replace(/\r\n/g, "\n");
let result = lfSrc;

// PATCH 1: Add import
const importHook = 'import { Solar } from "lunar-javascript";\n';
if (!result.includes(importHook)) {
  console.error("Import hook not found!");
  process.exit(1);
}
if (!result.includes('import { getLunarDate } from "@/lib/vietnamese-lunar";')) {
  result = result.replace(importHook, importHook + 'import { getLunarDate } from "@/lib/vietnamese-lunar";\n');
}

// PATCH 2: Modify getLunarText
const oldGetLunarText = `function getLunarText(dateString: string): { text: string, important: boolean } {
  const parsed = localDate(dateString);
  if (!parsed) return { text: "", important: false };
  const solar = Solar.fromYmd(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  const lunar = solar.getLunar();
  const lDay = lunar.getDay();
  const lMonth = lunar.getMonth();
  const important = lDay === 1 || lDay === 15;
  return { text: lDay === 1 ? \`\${lDay}/\${lMonth}\` : \`\${lDay}\`, important };
}`;

const newGetLunarText = `function getLunarText(dateString: string): { text: string, important: boolean } {
  const parsed = localDate(dateString);
  if (!parsed) return { text: "", important: false };
  const [lDay, lMonth, lYear, isLeap] = getLunarDate(parsed.getDate(), parsed.getMonth() + 1, parsed.getFullYear());
  const important = lDay === 1 || lDay === 15;
  return { text: lDay === 1 ? \`\${lDay}/\${lMonth}\` : \`\${lDay}\`, important };
}`;

if (!result.includes(oldGetLunarText)) {
  console.error("oldGetLunarText not found!");
  process.exit(1);
}
result = result.replace(oldGetLunarText, newGetLunarText);

// PATCH 3: Remove hidden min-[360px]:block from mobile calendar
const oldSpan = `<span className={\`text-[8px] -mt-0.5 leading-none \${lunarInfo.important ? "text-rose-500 font-bold" : "text-slate-400 dark:text-slate-500 hidden min-[360px]:block"}\`}>{lunarInfo.text}</span>`;
const newSpan = `<span className={\`text-[8px] -mt-0.5 leading-none \${lunarInfo.important ? "text-rose-500 font-bold" : "text-slate-400 dark:text-slate-500"}\`}>{lunarInfo.text}</span>`;

if (!result.includes(oldSpan)) {
  console.error("oldSpan not found!");
  process.exit(1);
}
result = result.replace(oldSpan, newSpan);

// Restore CRLF
result = result.replace(/\n/g, "\r\n");
writeFileSync(file, result, "utf8");
console.log("timetree-calendar.tsx patched successfully!");
