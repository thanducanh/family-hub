const fs = require('fs');
let c = fs.readFileSync('src/components/family-app.tsx', 'utf8');

const functions = `
function recordJobId(record: IncomeRecord) {
  return record.jobId || record.workId || "";
}

function jobMonthTotal(job: MemberJob, records: IncomeRecord[], month: number) {
  return records.filter(record => recordJobId(record) === job.id && record.month === month && record.status === "Đã nhận").reduce((sum, record) => sum + record.amount, 0);
}

function jobYearTotal(job: MemberJob, records: IncomeRecord[]) {
  return records.filter(record => recordJobId(record) === job.id && record.status === "Đã nhận").reduce((sum, record) => sum + record.amount, 0);
}
`;

c = c.replace('function Info({ label', functions + '\nfunction Info({ label');

fs.writeFileSync('src/components/family-app.tsx', c);
console.log('Added jobMonthTotal');
