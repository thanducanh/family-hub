import { pool } from "@/lib/db";
import type { IncomeCategory, IncomeFrequency, IncomeSourceType, IncomeStatus } from "@/types";

export type IncomeSourceRow = {
  id: string; memberId: string; memberName: string; name: string; type: IncomeSourceType;
  amount: number; frequency: IncomeFrequency; receivedDate: string; startDate: string;
  note: string; active: boolean; createdAt: string; updatedAt: string;
};
export type IncomeRecordRow = {
  id: string; sourceId: string; memberId: string; memberName: string; incomeDate: string; receivedDate: string;
  year: number; month: number; category: IncomeCategory; name: string; amount: number; status: IncomeStatus;
  note: string; createdAt: string; updatedAt: string;
};

const categories: IncomeCategory[] = ["Lương", "Thưởng", "Khác"];
const statuses: IncomeStatus[] = ["Đã nhận", "Chưa nhận"];
const validTypes = new Set(["fixed", "variable"]);
const validFrequencies = new Set(["monthly", "weekly", "yearly", "one_time", "custom"]);

export const incomeCategories = categories;
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

export function toIncomeRecord(row: Record<string, unknown>): IncomeRecordRow {
  const incomeDate = dateOnly(row.income_date || row.received_date);
  return {
    id: String(row.id),
    sourceId: String(row.source_id || ""),
    memberId: row.member_id ? String(row.member_id) : "",
    memberName: String(row.member_name || ""),
    incomeDate,
    receivedDate: incomeDate,
    year: Number(row.year || incomeDate.slice(0, 4) || 0),
    month: Number(row.month || incomeDate.slice(5, 7) || 0),
    category: category(row.category),
    name: String(row.name || ""),
    amount: Number(row.amount || 0),
    status: status(row.status),
    note: String(row.note || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export async function fetchIncomeData(year: number) {
  const [membersResult, sourcesResult, recordsResult] = await Promise.all([
    pool.query("SELECT id, name FROM members WHERE deleted_at IS NULL ORDER BY name"),
    pool.query(`SELECT s.*, m.name AS member_name
      FROM income_sources s
      JOIN members m ON m.id = s.member_id
      WHERE m.deleted_at IS NULL
      ORDER BY s.active DESC, m.name, s.name`),
    pool.query(`SELECT r.*, COALESCE(m.name, '') AS member_name
      FROM income_records r
      LEFT JOIN members m ON m.id = r.member_id AND m.deleted_at IS NULL
      WHERE r.year = $1
      ORDER BY r.income_date ASC, r.created_at ASC`, [year]),
  ]);

  const members = membersResult.rows.map(row => ({ id: String(row.id), name: String(row.name || "") }));
  const sources = sourcesResult.rows.map(toIncomeSource);
  const records = recordsResult.rows.map(toIncomeRecord);
  const sourceTemplates = Array.from(new Set([...incomeTemplateNames, ...sources.map(source => source.name).filter(Boolean)]));
  return { members, sources, sourceTemplates, records, allRecords: records, stats: buildIncomeStats(year, records) };
}

function buildIncomeStats(year: number, records: IncomeRecordRow[]) {
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, total: 0 }));
  const byMember: Record<string, { memberId: string; memberName: string; total: number }> = {};
  const byCategory: Record<IncomeCategory, number> = { "Lương": 0, "Thưởng": 0, "Khác": 0 };
  for (const record of records) {
    if (record.year !== year || record.status !== "Đã nhận") continue;
    monthlyTotals[record.month - 1].total += record.amount;
    byCategory[record.category] += record.amount;
    byMember[record.memberId] = byMember[record.memberId] || { memberId: record.memberId, memberName: record.memberName, total: 0 };
    byMember[record.memberId].total += record.amount;
  }
  const totalYear = monthlyTotals.reduce((sum, item) => sum + item.total, 0);
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
