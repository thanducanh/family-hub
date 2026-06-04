import { pool } from "@/lib/db";
import type { IncomeFrequency, IncomeSourceType } from "@/types";

export type IncomeMember = { id: string; name: string };
export type IncomeSourceRow = {
  id: string; memberId: string; memberName: string; name: string; type: IncomeSourceType;
  amount: number; frequency: IncomeFrequency; receivedDate: string; startDate: string;
  note: string; active: boolean; createdAt: string; updatedAt: string;
};
export type IncomeRecordRow = {
  id: string; sourceId: string; memberId: string; memberName: string; sourceName: string;
  sourceType: IncomeSourceType; amount: number; receivedDate: string; note: string;
  createdAt: string; generated?: boolean;
};

const validTypes = new Set(["fixed", "variable"]);
const validFrequencies = new Set(["monthly", "weekly", "yearly", "one_time", "custom"]);

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

export function toIncomeSource(row: Record<string, unknown>): IncomeSourceRow {
  return {
    id: String(row.id),
    memberId: String(row.member_id),
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
  return {
    id: String(row.id),
    sourceId: String(row.source_id || ""),
    memberId: String(row.member_id),
    memberName: String(row.member_name || ""),
    sourceName: String(row.source_name || ""),
    sourceType: validTypes.has(String(row.source_type)) ? String(row.source_type) as IncomeSourceType : "variable",
    amount: Number(row.amount || 0),
    receivedDate: dateOnly(row.received_date),
    note: String(row.note || ""),
    createdAt: String(row.created_at || ""),
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
    pool.query(`SELECT r.*, s.name AS source_name, COALESCE(s.type, 'variable') AS source_type, m.name AS member_name
      FROM income_records r
      LEFT JOIN income_sources s ON s.id = r.source_id
      JOIN members m ON m.id = r.member_id
      WHERE r.received_date >= $1::date AND r.received_date < $2::date AND m.deleted_at IS NULL
      ORDER BY r.received_date DESC, r.created_at DESC`, [`${year}-01-01`, `${year + 1}-01-01`]),
  ]);

  const members = membersResult.rows.map(row => ({ id: String(row.id), name: String(row.name || "") }));
  const sources = sourcesResult.rows.map(toIncomeSource);
  const records = recordsResult.rows.map(toIncomeRecord);
  const generatedRecords = generateFixedRecords(year, sources, records);
  const allRecords = [...records, ...generatedRecords].sort((left, right) => right.receivedDate.localeCompare(left.receivedDate));
  return { members, sources, records, generatedRecords, allRecords, stats: buildIncomeStats(year, sources, allRecords) };
}

function generateFixedRecords(year: number, sources: IncomeSourceRow[], records: IncomeRecordRow[]) {
  const actualMonthsBySource = new Set(records.filter(record => record.sourceId).map(record => `${record.sourceId}:${record.receivedDate.slice(0, 7)}`));
  const generated: IncomeRecordRow[] = [];
  for (const source of sources) {
    if (!source.active || source.type !== "fixed" || source.frequency !== "monthly") continue;
    const start = source.startDate || source.receivedDate || `${year}-01-01`;
    for (let month = 1; month <= 12; month++) {
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      if (monthKey < start.slice(0, 7) || actualMonthsBySource.has(`${source.id}:${monthKey}`)) continue;
      generated.push({
        id: `generated-${source.id}-${monthKey}`,
        sourceId: source.id,
        memberId: source.memberId,
        memberName: source.memberName,
        sourceName: source.name,
        sourceType: source.type,
        amount: source.amount,
        receivedDate: `${monthKey}-${String(Math.min(Number(source.receivedDate?.slice(-2)) || 1, 28)).padStart(2, "0")}`,
        note: source.note,
        createdAt: source.createdAt,
        generated: true,
      });
    }
  }
  return generated;
}

function buildIncomeStats(year: number, sources: IncomeSourceRow[], records: IncomeRecordRow[]) {
  const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, total: 0 }));
  const byMember: Record<string, { memberId: string; memberName: string; total: number }> = {};
  const byType = { fixed: 0, variable: 0 };
  for (const record of records) {
    if (!record.receivedDate.startsWith(String(year))) continue;
    const month = Number(record.receivedDate.slice(5, 7));
    monthlyTotals[month - 1].total += record.amount;
    byType[record.sourceType] += record.amount;
    byMember[record.memberId] = byMember[record.memberId] || { memberId: record.memberId, memberName: record.memberName, total: 0 };
    byMember[record.memberId].total += record.amount;
  }
  const totalYear = monthlyTotals.reduce((sum, item) => sum + item.total, 0);
  const fixedMonthly = sources.filter(source => source.active && source.type === "fixed" && source.frequency === "monthly").reduce((sum, source) => sum + source.amount, 0);
  return {
    year,
    totalYear,
    fixedMonthly,
    variableTotal: byType.variable,
    averageMonthly: totalYear / 12,
    monthlyTotals,
    byMember: Object.values(byMember).sort((left, right) => right.total - left.total),
    byType,
  };
}
