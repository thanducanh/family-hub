import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const actor = await getSessionUser(); if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    const { id, startDate } = await request.json() as { id?: string; startDate?: string };
    const current = await pool.query("SELECT e.*,c.owner_user_id,cu.permission FROM events e JOIN calendars c ON c.id=e.calendar_id LEFT JOIN calendar_users cu ON cu.calendar_id=c.id AND cu.user_id=$2 WHERE e.id=$1", [id, actor.id]);
    const row = current.rows[0];
    if (!row || (actor.role !== "full_access" && String(row.owner_user_id) !== actor.id && String(row.created_by_user_id) !== actor.id && row.permission !== "edit")) return NextResponse.json({ ok: false, error: "Không có quyền copy sự kiện." }, { status: 403 });
    if (!startDate) return NextResponse.json({ ok: false, error: "Thiếu ngày mới." }, { status: 400 });
    const duration = Math.max(0, Math.round((new Date(row.end_date).getTime() - new Date(row.start_date).getTime()) / 86400000));
    const end = new Date(`${startDate}T00:00:00`); end.setDate(end.getDate() + duration);
    const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    const eventDate = `${startDate}T${String(row.start_time ?? "00:00").slice(0, 5)}:00`;
    const newId = randomUUID();
    await pool.query("INSERT INTO events (id,calendar_id,title,start_date,start_time,end_date,end_time,all_day,note,created_by_user_id,date,time,event_date,color,type,label_color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$4,$5,$11,$12,$13,$14)", [newId, row.calendar_id, row.title, startDate, row.start_time, endDate, row.end_time, row.all_day, row.note || "", actor.id, eventDate, row.color || "#6366f1", row.type || "family", row.label_color || null]);
    await pool.query("INSERT INTO event_members (event_id,member_id) SELECT $1,member_id FROM event_members WHERE event_id=$2 ON CONFLICT DO NOTHING", [newId, id]);
    return NextResponse.json({ ok: true, data: { id: newId } }, { status: 201 });
  } catch (error) { console.error("[POST /api/events/copy]", error); return NextResponse.json({ ok: false, error: "Không thể copy sự kiện." }, { status: 500 }); }
}
