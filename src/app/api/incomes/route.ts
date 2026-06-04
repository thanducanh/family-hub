import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import { fetchIncomeData, normalizeYear, toIncomeRecord } from "@/lib/incomes";
import type { IncomeCategory, IncomeStatus } from "@/types";

const categories = new Set(["Lương", "Thưởng", "Tồn tháng trước", "Bán đồ", "Khác"]);
const statuses = new Set(["Đã nhận", "Chưa nhận"]);

function text(value: unknown) {
  return String(value || "").trim();
}
function moneyValue(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}
function dateValue(value: unknown) {
  const date = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
}
function normalizeRecordPayload(item: Record<string, unknown>) {
  const incomeDate = dateValue(item.incomeDate || item.income_date || item.receivedDate || item.received_date);
  const [year, month] = incomeDate.split("-").map(Number);
  const category = categories.has(text(item.category)) ? text(item.category) as IncomeCategory : "Khác";
  const status = statuses.has(text(item.status)) ? text(item.status) as IncomeStatus : "Đã nhận";
  return {
    id: text(item.id) || crypto.randomUUID(),
    incomeDate,
    year,
    month,
    category,
    name: text(item.name) || category,
    amount: moneyValue(item.amount),
    status,
    note: text(item.note),
    workSource: text(item.workSource),
  };
}

export async function GET(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const year = normalizeYear(new URL(request.url).searchParams.get("year"));
  const data = await fetchIncomeData(year);
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const body = await request.json() as Record<string, unknown> | Record<string, unknown>[];
  const rows = (Array.isArray(body) ? body : Array.isArray(body.rows) ? body.rows as Record<string, unknown>[] : [body]).map(normalizeRecordPayload);
  const payloadList = (Array.isArray(body) ? body : Array.isArray(body.rows) ? body.rows as Record<string, unknown>[] : [body]);
  if (!payloadList.length || payloadList.some(p => !p.name)) return NextResponse.json({ ok: false, error: "Thiếu tên khoản thu." }, { status: 400 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const saved = [];
    for (const payload of payloadList) {
      const row = normalizeRecordPayload(payload);
      const result = await client.query(
        `INSERT INTO income_records (id, source_id, member_id, income_date, year, month, category, name, amount, status, note, work_source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()) RETURNING *`,
        [
          row.id,
          text(payload.sourceId) || null,
          text(payload.memberId || actor.memberId) || null,
          row.incomeDate,
          row.year,
          row.month,
          row.category,
          row.name,
          row.amount,
          row.status,
          row.note,
          row.workSource || null,
        ]
      );
      saved.push(toIncomeRecord(result.rows[0]));
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, data: saved }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[POST /api/incomes]", error);
    return NextResponse.json({ ok: false, error: "Không thể lưu thu nhập." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(request: NextRequest) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  const payload = await request.json() as Record<string, unknown>;
  const row = normalizeRecordPayload({ ...payload, id });
  if (!row.id || !row.name) return NextResponse.json({ ok: false, error: "Thiếu id hoặc tên khoản thu." }, { status: 400 });
  const result = await pool.query(
    `UPDATE income_records
     SET member_id = $1, income_date = $2, year = $3, month = $4, category = $5, name = $6, amount = $7, status = $8, note = $9, work_source = $10, updated_at = NOW()
     WHERE id = $11 RETURNING *`,
    [
      text(payload.memberId || actor.memberId) || null,
      row.incomeDate,
      row.year,
      row.month,
      row.category,
      row.name,
      row.amount,
      row.status,
      row.note,
      row.workSource || null,
      id
    ]
  );
  if (!result.rows[0]) return NextResponse.json({ ok: false, error: "Không tìm thấy dòng thu nhập." }, { status: 404 });
  return NextResponse.json({ ok: true, data: toIncomeRecord(result.rows[0]) });
}

export async function DELETE(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Thiếu id." }, { status: 400 });
  await pool.query("DELETE FROM income_records WHERE id = $1", [id]);
  return NextResponse.json({ ok: true, data: { deleted: true } });
}
