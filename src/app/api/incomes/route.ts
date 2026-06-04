import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import { fetchIncomeData, normalizeYear, toIncomeSource } from "@/lib/incomes";
import type { IncomeFrequency, IncomeSourceType } from "@/types";

const validTypes = new Set(["fixed", "variable"]);
const validFrequencies = new Set(["monthly", "weekly", "yearly", "one_time", "custom"]);

function text(value: unknown) {
  return String(value || "").trim();
}
function moneyValue(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}
function dateValue(value: unknown) {
  const date = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}
function normalizePayload(item: Record<string, unknown>) {
  const type = validTypes.has(text(item.type)) ? text(item.type) as IncomeSourceType : "fixed";
  const frequency = validFrequencies.has(text(item.frequency)) ? text(item.frequency) as IncomeFrequency : "monthly";
  return {
    id: text(item.id) || crypto.randomUUID(),
    memberId: text(item.memberId || item.member_id),
    name: text(item.name),
    type,
    amount: moneyValue(item.amount),
    frequency,
    receivedDate: dateValue(item.receivedDate || item.received_date),
    startDate: dateValue(item.startDate || item.start_date || item.receivedDate || item.received_date),
    note: text(item.note),
    active: item.active === undefined ? true : Boolean(item.active),
    createRecord: Boolean(item.createRecord),
  };
}

export async function GET(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const year = normalizeYear(new URL(request.url).searchParams.get("year"));
  const data = await fetchIncomeData(year);
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const item = normalizePayload(await request.json() as Record<string, unknown>);
  if (!item.memberId || !item.name) return NextResponse.json({ ok: false, error: "Thiếu thành viên hoặc tên nguồn thu." }, { status: 400 });
  const result = await pool.query(`INSERT INTO income_sources
    (id, member_id, name, type, amount, frequency, received_date, start_date, note, active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *`, [item.id, item.memberId, item.name, item.type, item.amount, item.frequency, item.receivedDate, item.startDate, item.note, item.active]);
  if (item.createRecord && item.receivedDate) {
    await pool.query(`INSERT INTO income_records (source_id, member_id, amount, received_date, note)
      VALUES ($1,$2,$3,$4,$5)`, [item.id, item.memberId, item.amount, item.receivedDate, item.note]);
  }
  return NextResponse.json({ ok: true, data: toIncomeSource(result.rows[0]) }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  const item = normalizePayload({ ...(await request.json() as Record<string, unknown>), id });
  if (!item.id || !item.memberId || !item.name) return NextResponse.json({ ok: false, error: "Thiếu id, thành viên hoặc tên nguồn thu." }, { status: 400 });
  const result = await pool.query(`UPDATE income_sources SET
    member_id=$2, name=$3, type=$4, amount=$5, frequency=$6, received_date=$7, start_date=$8, note=$9, active=$10, updated_at=CURRENT_TIMESTAMP
    WHERE id=$1 RETURNING *`, [item.id, item.memberId, item.name, item.type, item.amount, item.frequency, item.receivedDate, item.startDate, item.note, item.active]);
  if (!result.rows[0]) return NextResponse.json({ ok: false, error: "Không tìm thấy nguồn thu." }, { status: 404 });
  return NextResponse.json({ ok: true, data: toIncomeSource(result.rows[0]) });
}

export async function DELETE(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Thiếu id." }, { status: 400 });
  await pool.query("DELETE FROM income_sources WHERE id = $1", [id]);
  return NextResponse.json({ ok: true, data: { deleted: true } });
}
