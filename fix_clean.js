const fs = require('fs');

let mjp = fs.readFileSync('src/components/member-job-page.tsx', 'utf8');

// 1. Add import right after "use client";
mjp = mjp.replace(/"use client";[\r\n]*/, '"use client";\nimport { JobIncomeManager } from "./job-income-manager";\n');

// 2. Remove function JobDetail
const jobDetailStart = mjp.indexOf('function JobDetail(');
const infoStart = mjp.indexOf('function Info(', jobDetailStart);
if (jobDetailStart !== -1 && infoStart !== -1) {
  mjp = mjp.substring(0, jobDetailStart) + mjp.substring(infoStart);
}

// 3. Fix the render conditional
// It currently has: return <div className="max-w-6xl space-y-5">
// We want: return <div className="max-w-6xl space-y-5">{viewing ? <JobIncomeManager... /> : <> ... </>}</div>
mjp = mjp.replace('return <div className="max-w-6xl space-y-5">', 'return <div className="max-w-6xl space-y-5">\n    {viewing ? <JobIncomeManager job={viewing} memberId={memberId} records={records} selectedYear={year} onBack={() => setViewing(null)} onUpdated={() => load()} /> : <>');

// The closing for this conditional: right after {deleting && ...}
const deletingStr = 'className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white">Xóa</button></div></div></div>}';
mjp = mjp.replace(deletingStr, deletingStr + '\n    </>\n    }');

// Remove the old {viewing && <JobDetail... />}
mjp = mjp.replace(/\{viewing && <JobDetail job=\{viewing\}[^>]*\/>\}/g, '');

fs.writeFileSync('src/components/member-job-page.tsx', mjp);
console.log('Fixed member-job-page.tsx cleanly');
