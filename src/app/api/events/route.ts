import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";

const fields = "e.id,e.calendar_id,e.title,e.start_date,e.start_time,e.end_date,e.end_time,e.all_day,e.note,e.created_by_user_id,e.created_at,COALESCE(e.label_color,c.color) color,e.label_color,ARRAY_REMOVE(ARRAY_AGG(DISTINCT em.member_id),NULL) member_ids";
function dateOnly(value: unknown) {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return String(value ?? "").slice(0, 10);
}
function view(row: Record<string, unknown>) {
  const startDate = dateOnly(row.start_date);
  const startTime = String(row.start_time ?? "").slice(0, 5);
  return { id: String(row.id), calendarId: String(row.calendar_id), title: String(row.title), startDate, startTime, endDate: dateOnly(row.end_date || startDate), endTime: String(row.end_time ?? "").slice(0, 5), allDay: Boolean(row.all_day), note: String(row.note ?? ""), createdByUserId: String(row.created_by_user_id ?? ""), createdAt: String(row.created_at ?? ""), color: String(row.color ?? "#6366f1"), labelColor: String(row.label_color ?? ""), memberIds: Array.isArray(row.member_ids) ? row.member_ids.map(String) : [], date: startDate, time: startTime, memberId: "" };
}
async function canUseCalendar(userId: string, role: string, calendarId: string, edit = false) {
  if (role === "full_access") return true;
  const result = await pool.query("SELECT 1 FROM calendars c LEFT JOIN calendar_users cu ON cu.calendar_id=c.id AND cu.user_id=$2 WHERE c.id=$1 AND (c.owner_user_id=$2 OR cu.permission=$3)", [calendarId, userId, edit ? "edit" : "view"]);
  return Boolean(result.rows[0]);
}
async function canEditEvent(userId: string, role: string, id: string) {
  const result = await pool.query("SELECT e.created_by_user_id,c.owner_user_id,cu.permission FROM events e JOIN calendars c ON c.id=e.calendar_id LEFT JOIN calendar_users cu ON cu.calendar_id=c.id AND cu.user_id=$2 WHERE e.id=$1", [id,userId]);
  return Boolean(result.rows[0] && (role === "full_access" || String(result.rows[0].created_by_user_id) === userId || String(result.rows[0].owner_user_id) === userId || result.rows[0].permission === "edit"));
}
export async function GET() {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    const where = actor.role === "full_access" ? "" : "WHERE c.owner_user_id=$1 OR EXISTS (SELECT 1 FROM calendar_users cu WHERE cu.calendar_id=c.id AND cu.user_id=$1)";
    const result = await pool.query(`SELECT ${fields} FROM events e JOIN calendars c ON c.id=e.calendar_id LEFT JOIN event_members em ON em.event_id=e.id ${where} GROUP BY e.id,c.id ORDER BY e.start_date,e.all_day DESC,e.start_time,e.created_at`, actor.role === "full_access" ? [] : [actor.id]);
    return NextResponse.json({ ok: true, data: result.rows.map(view) });
  } catch (error) { console.error("[GET /api/events]", error); return NextResponse.json({ ok: false, error: "Không thể tải sự kiện." }, { status: 500 }); }
}
async function save(request: NextRequest, update: boolean) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    const body = await request.json() as { id?: string; calendarId?: string; title?: string; startDate?: string; startTime?: string; endDate?: string; endTime?: string; allDay?: boolean; note?: string; labelColor?: string; memberIds?: string[] };
    if (!body.id || !body.calendarId || !body.title?.trim() || !body.startDate) return NextResponse.json({ ok: false, error: "Tiêu đề, lịch và ngày bắt đầu là bắt buộc." }, { status: 400 });
    if (!await canUseCalendar(actor.id, actor.role, body.calendarId, true) || (update && !await canEditEvent(actor.id, actor.role, body.id))) return NextResponse.json({ ok: false, error: "Không có quyền lưu sự kiện này." }, { status: 403 });
    const startTime = body.allDay ? null : body.startTime || "00:00"; const endTime = body.allDay ? null : body.endTime || null; const endDate = body.endDate || body.startDate; const eventDate = `${body.startDate}T${startTime || "00:00"}:00`;
    const result = update
      ? await pool.query("UPDATE events SET calendar_id=$2,title=$3,start_date=$4,start_time=$5,end_date=$6,end_time=$7,all_day=$8,note=$9,date=$4,time=$5,event_date=$10,label_color=$11 WHERE id=$1 RETURNING id", [body.id, body.calendarId, body.title.trim(), body.startDate, startTime, endDate, endTime, body.allDay ?? false, body.note || "", eventDate, body.labelColor || null])
      : await pool.query("INSERT INTO events (id,calendar_id,title,start_date,start_time,end_date,end_time,all_day,note,created_by_user_id,date,time,event_date,color,type,label_color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$4,$5,$11,'#6366f1','family',$12) RETURNING id", [body.id, body.calendarId, body.title.trim(), body.startDate, startTime, endDate, endTime, body.allDay ?? false, body.note || "", actor.id, eventDate, body.labelColor || null]);
    await pool.query("DELETE FROM event_members WHERE event_id=$1", [body.id]);
    for (const memberId of [...new Set(body.memberIds || [])]) await pool.query("INSERT INTO event_members (event_id,member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [body.id, memberId]);
    return NextResponse.json({ ok: true, data: { id: String(result.rows[0].id) } }, { status: update ? 200 : 201 });
  } catch (error) { console.error("[SAVE /api/events]", error); return NextResponse.json({ ok: false, error: "Không thể lưu sự kiện." }, { status: 500 }); }
}
export async function POST(request: NextRequest) { return save(request, false); }
export async function PUT(request: NextRequest) { return save(request, true); }
export async function DELETE(request: NextRequest) {
  try {
    const actor = await getSessionUser(); if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!await canEditEvent(actor.id, actor.role, id)) return NextResponse.json({ ok: false, error: "Không có quyền xóa sự kiện." }, { status: 403 });
    await pool.query("DELETE FROM events WHERE id=$1", [id]); return NextResponse.json({ ok: true });
  } catch (error) { console.error("[DELETE /api/events]", error); return NextResponse.json({ ok: false, error: "Không thể xóa sự kiện." }, { status: 500 }); }
}
