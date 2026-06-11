const fs = require('fs');

// 1. Fix family-app.tsx "use client"
let fa = fs.readFileSync('src/components/family-app.tsx', 'utf8');
// remove all occurrences of `import { JobIncomeManager } from "./job-income-manager";`
fa = fa.replace(/import \{ JobIncomeManager \} from "\.\/job-income-manager";[\r\n]*/g, '');
// Add it after "use client";
fa = fa.replace(/"use client";[\r\n]*/, '"use client";\nimport { JobIncomeManager } from "./job-income-manager";\n');
fs.writeFileSync('src/components/family-app.tsx', fa);

// 2. Fix member-job-page.tsx
let mjp = fs.readFileSync('src/components/member-job-page.tsx', 'utf8');
mjp = 'import { JobIncomeManager } from "./job-income-manager";\n' + mjp;

const jobDetailStart = mjp.indexOf('function JobDetail(');
let jobDetailEnd = mjp.indexOf('function Info(', jobDetailStart);
// remove JobDetail
mjp = mjp.substring(0, jobDetailStart) + mjp.substring(jobDetailEnd);

mjp = mjp.replace(
  'return <div className="max-w-6xl space-y-5">', 
  'return <div className="max-w-6xl space-y-5">\n    {viewing ? <JobIncomeManager job={viewing} memberId={memberId} records={records} selectedYear={year} onBack={() => setViewing(null)} onUpdated={() => load()} /> : <>\n'
);

const deletingBlock = mjp.indexOf('{deleting && <div className="fixed inset-0');
const endOfReturn = mjp.indexOf('</div>;', deletingBlock);
const divClose = mjp.lastIndexOf('</div>', endOfReturn);
mjp = mjp.substring(0, divClose + 6) + '\n    </>\n    }\n  </div>;';

mjp = mjp.replace(/\{viewing && <JobDetail job=\{viewing\}.*?\/>\}/g, '');

fs.writeFileSync('src/components/member-job-page.tsx', mjp);

// 3. Fix job-income-manager.tsx template literal
let jim = fs.readFileSync('src/components/job-income-manager.tsx', 'utf8');
jim = jim.replace(/\\`/g, '`');
jim = jim.replace(/\\\$/g, '$');
fs.writeFileSync('src/components/job-income-manager.tsx', jim);

console.log('Fixed all syntax errors');
