const fs = require('fs');
let c = fs.readFileSync('src/components/member-job-page.tsx', 'utf8');

c = 'import { JobIncomeManager } from "./job-income-manager";\n' + c;

const jobDetailStart = c.indexOf('function JobDetail(');
let jobDetailEnd = c.indexOf('function Info(', jobDetailStart);
// remove JobDetail
c = c.substring(0, jobDetailStart) + c.substring(jobDetailEnd);

c = c.replace(/\{viewing && <JobDetail job=\{viewing\} records=\{records\} year=\{year\} close=\{.*?\} edit=\{.*?\} \/>\}/g, '{viewing && <JobIncomeManager job={viewing} memberId={memberId} records={records} selectedYear={year} onBack={() => setViewing(null)} onUpdated={() => load()} />}');

fs.writeFileSync('src/components/member-job-page.tsx', c);
console.log('Replaced JobDetail');
