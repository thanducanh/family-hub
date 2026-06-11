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

const categories: IncomeCategory[] = ["Lương", "Thưởng", "Tiền lễ", "Khác"];
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
  try {
    const result = await pool.query(
      `SELECT r.*, m.name AS member_name, CONCAT_WS(' · ', NULLIF(j.title, ''), NULLIF(j.company, '')) AS job_name
       FROM income_records r
       LEFT JOIN members m ON m.id = r.member_id
       LEFT JOIN member_jobs j ON j.id = COALESCE(r.job_id, r.work_id)
       ORDER BY COALESCE(r.received_date, r.income_date) ASC, r.created_at ASC`
    );

    const allRows = result.rows.map(toIncomeRecord);
    const records = allRows.filter(r => r.year === year);
    
    // Tính tổng năm
    const yearlyComparisonMap = new Map<number, number>();
    for (const r of allRows) {
      if (!isReceivedStatusValue(r.status)) continue;
      yearlyComparisonMap.set(r.year, (yearlyComparisonMap.get(r.year) || 0) + r.amount);
    }
    const yearlyComparison = Array.from(yearlyComparisonMap.entries())
      .map(([y, total]) => ({ year: y, total }))
      .sort((a, b) => b.year - a.year);

    // Tính yearlySummaries (mảng rỗng vì không dùng bảng đó nữa)
    const yearlySummaries: IncomeYearlySummaryRow[] = [];
    const jobsResult = await pool.query('SELECT * FROM member_jobs ORDER BY start_year DESC NULLS LAST, created_at DESC');
    const jobs = jobsResult.rows.map(toMemberJob);
    const membersResult = await pool.query("SELECT id, name FROM members WHERE deleted_at IS NULL ORDER BY name ASC");
    return {
      members: membersResult.rows.map(row => ({ id: String(row.id), name: String(row.name || "") })),
      sources: [],
      records,
      allRecords: records,
      yearlySummaries,
      yearlyComparison,
      jobs
    };
  } catch (error) {
    console.error("fetchIncomeData error:", error);
    return {
      members: [],
      sources: [],
      records: [],
      allRecords: [],
      yearlySummaries: [],
      yearlyComparison: [],
      jobs: []
    };
  }
}
