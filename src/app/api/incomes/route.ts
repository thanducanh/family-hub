import { NextRequest, NextResponse } from "next/server";
export const dynamic = 'force-dynamic';
import { getSessionUser, requireSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import { fetchIncomeData, normalizeYear, toIncomeRecord } from "@/lib/incomes";
import type { IncomeCategory, IncomeStatus } from "@/types";

const categories = new Set(["Lương", "Thưởng", "Tiền lễ", "Khác"]);
const statuses = new Set(["Đã nhận", "Chưa nhận"]);

function text(value: unknown) {
  return String(value || "").trim();
}
function moneyValue(value: unknown) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 ? amount : 0;
}
function dateValue(value: unknown) {
  const date = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
}
function normalizeRecordPayload(item: Record<string, unknown>) {
  const incomeDate = dateValue(item.receivedDate || item.received_date || item.incomeDate || item.income_date || item.date);
  const [year, month] = incomeDate.split("-").map(Number);
  const category = categories.has(text(item.category)) ? text(item.category) as IncomeCategory : "Khác";
  const status = statuses.has(text(item.status)) ? text(item.status) as IncomeStatus : "Đã nhận";
    let rawJobId = text(item.jobId || item.job_id || item.workId || item.work_id);
    if (rawJobId === "none" || rawJobId === "other" || rawJobId === "") {
        rawJobId = "";
    }
    return {
      id: text(item.id) || crypto.randomUUID(),
      incomeDate,
      year,
      month,
      category,
      name: text(item.name || item.content || item.description) || category,
      amount: moneyValue(item.amount),
      status,
      note: text(item.note),
      jobId: rawJobId || null,
    };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const year = normalizeYear(new URL(request.url).searchParams.get("year"));
  const data = await fetchIncomeData(year, user);
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: NextRequest) {
  const actor = await getSessionUser();
  console.log("[POST /api/incomes] actor:", actor);
  if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  let body: Record<string, unknown> | Record<string, unknown>[];
  try {
    body = await request.json() as Record<string, unknown> | Record<string, unknown>[];
    console.log("[POST /api/incomes] body:", JSON.stringify(body, null, 2));
  } catch (error) {
    return NextResponse.json({ ok: false, success: false, error: "JSON không hợp lệ.", details: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
  const payloadList = (Array.isArray(body) ? body : Array.isArray(body.rows) ? body.rows as Record<string, unknown>[] : [body]);
  const invalidContent = payloadList.some(p => !text(p.name || p.content || p.description));
  const invalidAmount = payloadList.some(p => moneyValue(p.amount) <= 0);
  if (!payloadList.length) return NextResponse.json({ ok: false, success: false, error: "Không có dữ liệu thu nhập để lưu.", details: "Payload rows is empty." }, { status: 400 });
  if (invalidContent) return NextResponse.json({ ok: false, success: false, error: "Thiếu nội dung khoản thu.", details: "content/name/description is required." }, { status: 400 });
  if (invalidAmount) return NextResponse.json({ ok: false, success: false, error: "Số tiền không hợp lệ.", details: "amount must be a positive integer." }, { status: 400 });

  const actorRole = String(actor.role);
  const isAdmin = actorRole === "full_access" || actorRole === "system_admin" || actorRole === "admin";
  const defaultMemberId = text(actor.memberId);
  const validatedMemberIds = new Map<Record<string, unknown>, string>();
  for (const p of payloadList) {
    const targetMemberId = isAdmin ? (text(p.memberId || p.member_id) || defaultMemberId) : defaultMemberId;
    if (!targetMemberId) return NextResponse.json({ ok: false, success: false, error: "Chưa xác định thành viên nhận thu nhập.", details: "memberId is empty." }, { status: 400 });
    validatedMemberIds.set(p, targetMemberId);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const saved = [];
    for (const payload of payloadList) {
      const row = normalizeRecordPayload(payload);
      const targetMemberId = validatedMemberIds.get(payload) || defaultMemberId;
      console.log("[POST /api/incomes] payload before insert:", JSON.stringify({ payload, row, targetMemberId }, null, 2));
      try {
        const result = await client.query(
          `INSERT INTO income_records (id, source_id, member_id, job_id, work_id, received_date, income_date, year, month, category, name, amount, status, note, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()) RETURNING *`,
          [
            row.id,
            text(payload.sourceId) || null,
            targetMemberId,
            row.jobId,
            row.incomeDate,
            row.year,
            row.month,
            row.category,
            row.name,
            row.amount,
            row.status,
            row.note || "",
          ]
        );
        saved.push(toIncomeRecord(result.rows[0]));
      } catch (sqlError) {
        console.error("[POST /api/incomes] SQL INSERT ERROR:", sqlError);
        throw sqlError;
      }
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, success: true, data: saved }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[POST /api/incomes]", error);
    return NextResponse.json({ ok: false, success: false, error: "Không thể lưu thu nhập.", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
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
  const isAdmin = actor.role === "full_access";
  const defaultMemberId = text(actor.memberId);
  const targetMemberId = isAdmin ? (text(payload.memberId || payload.member_id) || defaultMemberId) : defaultMemberId;
  if (!targetMemberId) return NextResponse.json({ ok: false, error: "Thiếu thông tin thành viên." }, { status: 400 });

  console.log("[PUT /api/incomes] payload before update:", JSON.stringify({ payload, row, targetMemberId }, null, 2));

  try {
    const result = await pool.query(
      `UPDATE income_records
       SET member_id = $1, job_id = $2, work_id = $2, income_date = $3, year = $4, month = $5, category = $6, name = $7, amount = $8, status = $9, note = $10, updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [
        targetMemberId,
        row.jobId,
        row.incomeDate,
        row.year,
        row.month,
        row.category,
        row.name,
        row.amount,
        row.status,
        row.note,
        id
      ]
    );
    if (!result.rows[0]) return NextResponse.json({ ok: false, error: "Không tìm thấy dòng thu nhập." }, { status: 404 });
    return NextResponse.json({ ok: true, data: toIncomeRecord(result.rows[0]) });
  } catch (sqlError) {
    console.error("[PUT /api/incomes] SQL UPDATE ERROR:", sqlError);
    return NextResponse.json({ ok: false, error: "Lỗi lưu Database.", details: String(sqlError) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!await requireSession()) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Thiếu id." }, { status: 400 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deleted = await client.query("DELETE FROM income_records WHERE id = $1 RETURNING id", [id]);
    if (!deleted.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Không tìm thấy dòng thu nhập." }, { status: 404 });
    }
    const remaining = await client.query("SELECT id FROM income_records WHERE id = $1", [id]);
    if (remaining.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "Không thể xác nhận xóa khoản thu." }, { status: 500 });
    }
    await client.query("COMMIT");
    return NextResponse.json({ ok: true, data: { deleted: true, id } });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[DELETE /api/incomes]", error);
    return NextResponse.json({ ok: false, error: "Không thể xóa khoản thu.", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  } finally {
    client.release();
  }
}
