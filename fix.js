const fs = require('fs');
let content = fs.readFileSync('src/lib/incomes.ts', 'utf8');
const correct = `export function toIncomeRecord(row: Record<string, unknown>): IncomeRecordRow {
  const incomeDate = dateOnly(row.received_date || row.income_date);
  const jobId = String(row.job_id || row.work_id || "");
  const jobName = String(row.job_name || row.work_name || "");
  return {
    id: String(row.id),
    sourceId: String(row.source_id || ""),
    memberId: row.member_id ? String(row.member_id) : "",
    memberName: String(row.member_name || ""),
    jobId,
    jobName,
    workId: jobId,
    workName: jobName,
    workSource: String(row.work_source || ""),
    incomeDate,
    receivedDate: incomeDate,
    year: Number(incomeDate.slice(0, 4) || row.year || 0),
    month: Number(incomeDate.slice(5, 7) || row.month || 0),
    category: category(row.category),
    name: String(row.name || "Thu nhập"),
    amount: Number(row.amount || 0),
    status: status(row.status),
    note: String(row.note || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}`;
const start = content.indexOf('export function toIncomeRecord');
const end = content.indexOf('function isReceivedStatusValue');
content = content.substring(0, start) + correct + '\n\n' + content.substring(end);
fs.writeFileSync('src/lib/incomes.ts', content);
console.log("Done");
