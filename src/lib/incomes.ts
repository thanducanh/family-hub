import { pool } from "@/lib/db";
import type { IncomeCategory, IncomeFrequency, IncomeSourceType, IncomeStatus, IncomeYearlySummaryRow, MemberJob } from "@/types";

export type IncomeSourceRow = {
  id: string; memberId: string; memberName: string; name: string; type: IncomeSourceType;
  amount: number; frequency: IncomeFrequency; receivedDate: string; startDate: string;
  note: string; active: boolean; createdAt: string; updatedAt: string;
};
export type IncomeRecordRow = {
  id: string; sourceId: string; memberId: string; memberName: string; jobId: string; jobName: string; workId: string; workName: string; workSource: string; incomeDate: string; receivedDate: string;
  year: number; month: number; category: IncomeCategory; name: string; amount: number; status: IncomeStatus;
  note: string; createdAt: string; updatedAt: string;
};

const categories: IncomeCategory[] = ["Lương", "Thưởng", "Khác"];
const statuses: IncomeStatus[] = ["Đã nhận", "Chưa nhận"];
const validTypes = new Set(["fixed", "variable"]);
const validFrequencies = new Set(["monthly", "weekly", "yearly", "one_time", "custom"]);

export const incomeCategories = categories;
export const workSourceOptions = ["Công việc chính", "Job 2", "Freelance", "Thu nhập thêm", "Khác"];
export const incomeTemplateNames = ["Lương CB", "Lương KQCV", "Thưởng", "Tiền tồn tháng trước", "Khác"];

export function normalizeYear(value: string | null) {
  const year = Number(value || new Date().getFullYear());
  return Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : new Date().getFullYear();
}

function dateOnly(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  return text.includes("T") ? text.slice(0, 10) : text;
}

function category(value: unknown): IncomeCategory {
  const text = String(value || "");
  return categories.includes(text as IncomeCategory) ? text as IncomeCategory : "Khác";
}

function status(value: unknown): IncomeStatus {
  const text = String(value || "");
  return statuses.includes(text as IncomeStatus) ? text as IncomeStatus : "Đã nhận";
}

export function toIncomeSource(row: Record<string, unknown>): IncomeSourceRow {
  return {
    id: String(row.id),
    memberId: row.member_id ? String(row.member_id) : "",
    memberName: String(row.member_name || ""),
    name: String(row.name || ""),
    type: validTypes.has(String(row.type)) ? String(row.type) as IncomeSourceType : "fixed",
    amount: Number(row.amount || 0),
    frequency: validFrequencies.has(String(row.frequency)) ? String(row.frequency) as IncomeFrequency : "monthly",
    receivedDate: dateOnly(row.received_date),
    startDate: dateOnly(row.start_date),
    note: String(row.note || ""),
    active: Boolean(row.active),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export function toIncomeYearlySummary(row: Record<string, unknown>): IncomeYearlySummaryRow {
  return {
    id: String(row.id),
    memberId: row.member_id ? String(row.member_id) : "",
    year: Number(row.year || 0),
    category: category(row.category),
    name: String(row.name || ""),
    amount: Number(row.amount || 0),
    note: String(row.note || ""),
    workSource: String(row.work_source || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export function toIncomeRecord(row: Record<string, unknown>): IncomeRecordRow {
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
}

function isReceivedStatusValue(value: unknown) {
  const text = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  return !text || !text.includes("chua");
}

function toMemberJob(row: Record<string, unknown>): MemberJob {
  const status = String(row.status) === "ended" ? "ended" : "active";
  return {
    id: String(row.id),
    memberId: String(row.member_id || ""),
    title: String(row.title || ""),
    company: String(row.company || ""),
    startYear: row.start_year === null || row.start_year === undefined ? null : Number(row.start_year),
    endYear: status === "active" || row.end_year === null || row.end_year === undefined ? null : Number(row.end_year),
    status,
    note: String(row.note || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export async function fetchIncomeData(year: number) {
  const [membersResult, sourcesResult, recordsResult, yearlyResult, yearTotalsResult, jobsResult] = await Promise.all([
    pool.query("SELECT id, name FROM members WHERE deleted_at IS NULL ORDER BY name"),
    pool.query(`SELECT s.*, m.name AS member_name
      FROM income_sources s
      JOIN members m ON m.id = s.member_id
      WHERE m.deleted_at IS NULL
      ORDER BY s.active DESC, m.name, s.name`),
    pool.query(`SELECT r.*, COALESCE(r.job_id, r.work_id) AS job_id, COALESCE(m.name, '') AS member_name, COALESCE(j.title || ' · ' || j.company, '') AS job_name
      FROM income_records r
      LEFT JOIN members m ON m.id = r.member_id AND m.deleted_at IS NULL
      LEFT JOIN member_jobs j ON j.id = COALESCE(r.job_id, r.work_id)
      WHERE r.year = $1 OR CAST(EXTRACT(YEAR FROM COALESCE(r.received_date, r.income_date)) AS INTEGER) = $1
      ORDER BY COALESCE(r.received_date, r.income_date) ASC, r.created_at ASC`, [year]),
    pool.query(`SELECT * FROM income_yearly_summaries ORDER BY year DESC, created_at ASC`).catch(e => { console.warn("Skip yearly:", e.message); return { rows: [] }; }),
    pool.query(`SELECT COALESCE(CAST(EXTRACT(YEAR FROM COALESCE(received_date, income_date)) AS INTEGER), year) as year, SUM(amount) as total FROM income_records GROUP BY COALESCE(CAST(EXTRACT(YEAR FROM COALESCE(received_date, income_date)) AS INTEGER), year)`),
    pool.query(`SELECT id, member_id, title, company, start_year, end_year, status, note, created_at, updated_at FROM member_jobs ORDER BY start_year DESC NULLS LAST, created_at DESC`),
  ]);

  const members = membersResult.rows.map(row => ({ id: String(row.id), name: String(row.name || "") }));
  const sources = sourcesResult.rows.map(toIncomeSource);
  const records = recordsResult.rows.map(toIncomeRecord);
  const yearlySummaries = yearlyResult.rows.map(toIncomeYearlySummary);
  const jobs = jobsResult.rows.map(toMemberJob);
  const yearlyComparisonMap: Record<number, number> = {};
  for (const row of yearTotalsResult.rows) yearlyComparisonMap[Number(row.year)] = Number(row.total || 0);
  for (const sum of yearlySummaries) yearlyComparisonMap[sum.year] = (yearlyComparisonMap[sum.year] || 0) + sum.amount;
  const yearlyComparison = Object.entries(yearlyComparisonMap).map(([y, t]) => ({ year: Number(y), total: t })).sort((a, b) => a.year - b.year);
  const sourceTemplates = Array.from(new Set([...incomeTemplateNames, ...sources.map(source => source.name).filter(Boolean)]));
  return { members, sources, jobs, sourceTemplates, records, allRecords: records, yearlySummaries, yearlyComparison, stats: buildIncomeStats(year, records, yearlySummaries) };
}

function buildIncomeStats(year: number, records: IncomeRecordRow[], yearlySummaries: IncomeYearlySummaryRow[]) {
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, total: 0 }));
  const byMember: Record<string, { memberId: string; memberName: string; total: number }> = {};
  const byCategory: Record<IncomeCategory, number> = { "Lương": 0, "Thưởng": 0, "Khác": 0 };
  for (const record of records) {
    if (record.year !== year || !isReceivedStatusValue(record.status)) continue;
    monthlyTotals[record.month - 1].total += record.amount;
    byCategory[record.category] += record.amount;
    byMember[record.memberId] = byMember[record.memberId] || { memberId: record.memberId, memberName: record.memberName, total: 0 };
    byMember[record.memberId].total += record.amount;
  }
  const recordsTotalYear = monthlyTotals.reduce((sum, item) => sum + item.total, 0);
  const currentYearSummaries = yearlySummaries.filter(s => s.year === year);
  for (const s of currentYearSummaries) byCategory[s.category] += s.amount;
  const yearlySummariesTotal = currentYearSummaries.reduce((sum, item) => sum + item.amount, 0);
  const totalYear = recordsTotalYear + yearlySummariesTotal;
  return {
    year,
    totalYear,
    fixedMonthly: 0,
    variableTotal: totalYear,
    averageMonthly: totalYear / 12,
    monthlyTotals,
    byMember: Object.values(byMember).sort((left, right) => right.total - left.total),
    byCategory,
    byType: { fixed: 0, variable: totalYear },
  };
}
