import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { createSystemNotification } from "@/lib/server-notifications";

const fields = `
  e.id,
  COALESCE(e.calendar_id, c.id) AS calendar_id,
  e.title,
  COALESCE(e.start_date, e.date, e.event_date::date, e.created_at::date) AS start_date,
  COALESCE(e.start_time, e.time, e.event_date::time) AS start_time,
  COALESCE(e.end_date, e.start_date, e.date, e.event_date::date, e.created_at::date) AS end_date,
  e.end_time,
  COALESCE(e.all_day, e.is_all_day, FALSE) AS all_day,
  COALESCE(e.type, c.type, 'family') AS type,
  COALESCE(e.location, '') AS location,
  COALESCE(e.note, e.description, '') AS note,
  COALESCE(e.reminder_minutes, 0) AS reminder_minutes,
  COALESCE(e.repeat_rule, 'none') AS repeat_rule,
  COALESCE(e.status, 'open') AS status,
  e.created_by_user_id,
  e.created_at,
  COALESCE(e.label_color, c.color, e.color, '#6366f1') AS color,
  COALESCE(e.label_color, '') AS label_color,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT em.member_id), NULL) AS member_ids,
  COALESCE(e.visibility, 'all') AS visibility,
  COALESCE(e.allowed_member_ids, '[]') AS allowed_member_ids,
  COALESCE(e.related_member_ids, '[]') AS related_member_ids
`;

function dateOnly(value: unknown) {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  return String(value ?? "").slice(0, 10);
}
function timeOnly(value: unknown) {
  return String(value ?? "").slice(0, 5);
}
function view(row: Record<string, unknown>) {
  const startDate = dateOnly(row.start_date);
  const startTime = timeOnly(row.start_time);
  return {
    id: String(row.id),
    calendarId: String(row.calendar_id),
    title: String(row.title || "Sự kiện"),
    startDate,
    startTime,
    endDate: dateOnly(row.end_date || startDate),
    endTime: timeOnly(row.end_time),
    allDay: Boolean(row.all_day),
    type: String(row.type || "family"),
    location: String(row.location || ""),
    note: String(row.note || ""),
    reminderMinutes: Number(row.reminder_minutes || 0),
    repeatRule: String(row.repeat_rule || "none"),
    status: String(row.status || "open"),
    createdByUserId: String(row.created_by_user_id ?? ""),
    createdAt: String(row.created_at ?? ""),
    color: String(row.color ?? "#6366f1"),
    labelColor: String(row.label_color ?? ""),
    memberIds: Array.isArray(row.member_ids) ? row.member_ids.map(String) : [],
    visibility: String(row.visibility || "all"),
    allowedMemberIds: (() => { try { return JSON.parse(String(row.allowed_member_ids || "[]")); } catch { return []; } })(),
    relatedMemberIds: (() => { try { return JSON.parse(String(row.related_member_ids || "[]")); } catch { return []; } })(),
    date: startDate,
    time: startTime,
    memberId: ""
  };
}
async function ensureEventSchema() {
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS date DATE");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS time TIME");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS event_date TIMESTAMPTZ");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS color VARCHAR(32) NOT NULL DEFAULT '#60a5fa'");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS type VARCHAR(32) NOT NULL DEFAULT 'family'");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS start_date DATE");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date DATE");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TIME");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIME");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT FALSE");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN NOT NULL DEFAULT FALSE");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS note TEXT");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS repeat_rule TEXT NOT NULL DEFAULT 'none'");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS label_color VARCHAR(32)");
  await pool.query(`UPDATE events SET start_date = COALESCE(start_date, date, event_date::date, created_at::date) WHERE start_date IS NULL`);
  await pool.query(`UPDATE events SET end_date = COALESCE(end_date, start_date, date, event_date::date, created_at::date) WHERE end_date IS NULL`);
  await pool.query(`UPDATE events SET start_time = COALESCE(start_time, time, event_date::time) WHERE start_time IS NULL AND COALESCE(all_day, is_all_day, FALSE) = FALSE`);
  await pool.query(`UPDATE events SET calendar_id = (SELECT id FROM calendars ORDER BY created_at, name LIMIT 1) WHERE calendar_id IS NULL AND EXISTS (SELECT 1 FROM calendars)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_members (
      event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      PRIMARY KEY (event_id, member_id)
    )
  `);
  await pool.query(`INSERT INTO event_members (event_id, member_id) SELECT id, member_id FROM events WHERE member_id IS NOT NULL ON CONFLICT DO NOTHING`);
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'all'");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS allowed_member_ids TEXT");
  await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS related_member_ids TEXT");
  
  // Also ensure notifications has the required columns for event notifications
  await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_by_name VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    visible_user_ids JSONB DEFAULT '[]',
    read_user_ids JSONB DEFAULT '[]'
  )`);
  await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_type TEXT");
  await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_id TEXT");
  await pool.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata TEXT");
}
async function canUseCalendar(userId: string, role: string, calendarId: string, edit = false) {
  if (role === "full_access") return true;
  const result = await pool.query("SELECT 1 FROM calendars c LEFT JOIN calendar_users cu ON cu.calendar_id=c.id AND cu.user_id=$2 WHERE c.id=$1 AND (c.owner_user_id=$2 OR cu.permission=$3)", [calendarId, userId, edit ? "edit" : "view"]);
  return Boolean(result.rows[0]);
}
async function canEditEvent(userId: string, role: string, id: string) {
  const result = await pool.query("SELECT e.created_by_user_id,c.owner_user_id,cu.permission FROM events e JOIN calendars c ON c.id=e.calendar_id LEFT JOIN calendar_users cu ON cu.calendar_id=c.id AND cu.user_id=$2 WHERE e.id=$1", [id, userId]);
  return Boolean(result.rows[0] && (role === "full_access" || String(result.rows[0].created_by_user_id) === userId || String(result.rows[0].owner_user_id) === userId || result.rows[0].permission === "edit"));
}
function isIsoDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}
function isTime(value?: string) {
  return Boolean(!value || /^\d{2}:\d{2}$/.test(value));
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    await ensureEventSchema();

    const month = Number(request.nextUrl.searchParams.get("month") || 0);
    const year = Number(request.nextUrl.searchParams.get("year") || 0);
    const accessWhere = actor.role === "full_access" ? "" : "AND (c.owner_user_id=$1 OR EXISTS (SELECT 1 FROM calendar_users cu WHERE cu.calendar_id=c.id AND cu.user_id=$1))";
    
    let visibilityWhere = "";
    if (actor.role !== "full_access") {
      const actorMemberId = actor.memberId || ""; // Using existing actor.memberId if available
      visibilityWhere = `AND (
        COALESCE(e.visibility, 'all') = 'all'
        OR (e.visibility = 'private' AND e.created_by_user_id = $1)
        OR (e.visibility = 'custom' AND (
            e.created_by_user_id = $1 OR 
            (COALESCE(e.allowed_member_ids, '[]')::jsonb ? '${actorMemberId}')
        ))
      )`;
    }

    const params: Array<string | number> = actor.role === "full_access" ? [] : [actor.id];
    let dateWhere = "";
    if (month >= 1 && month <= 12 && year >= 1900) {
      const paramOffset = params.length;
      dateWhere = `AND EXTRACT(MONTH FROM COALESCE(e.start_date, e.date, e.event_date::date, e.created_at::date)) = $${paramOffset + 1} AND EXTRACT(YEAR FROM COALESCE(e.start_date, e.date, e.event_date::date, e.created_at::date)) = $${paramOffset + 2}`;
      params.push(month, year);
    }
    const result = await pool.query(
      `SELECT ${fields}
       FROM events e
       LEFT JOIN calendars c ON c.id=e.calendar_id
       LEFT JOIN event_members em ON em.event_id=e.id
       WHERE TRUE ${accessWhere} ${visibilityWhere} ${dateWhere}
       GROUP BY e.id,c.id
       ORDER BY COALESCE(e.start_date, e.date, e.event_date::date, e.created_at::date), COALESCE(e.all_day, e.is_all_day, FALSE) DESC, COALESCE(e.start_time, e.time, e.event_date::time), e.created_at`,
      params
    );
    return NextResponse.json({ ok: true, data: result.rows.map(view) });
  } catch (error) {
    console.error("[GET /api/events]", error);
    return NextResponse.json({ ok: false, error: "Không thể tải sự kiện." }, { status: 500 });
  }
}

async function save(request: NextRequest, update: boolean) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    await ensureEventSchema();

    const body = await request.json() as {
      id?: string;
      calendarId?: string;
      title?: string;
      startDate?: string;
      startTime?: string;
      endDate?: string;
      endTime?: string;
      allDay?: boolean;
      type?: string;
      location?: string;
      note?: string;
      reminderMinutes?: number;
      repeatRule?: string;
      status?: string;
      labelColor?: string;
      memberIds?: string[];
      visibility?: "all" | "private" | "custom";
      allowedMemberIds?: string[];
      relatedMemberIds?: string[];
    };
    if (!body.id || !body.calendarId || !body.title?.trim() || !isIsoDate(body.startDate)) {
      return NextResponse.json({ ok: false, error: "Tiêu đề, lịch và ngày bắt đầu là bắt buộc." }, { status: 400 });
    }
    if (!isIsoDate(body.endDate || body.startDate) || !isTime(body.startTime) || !isTime(body.endTime)) {
      return NextResponse.json({ ok: false, error: "Ngày hoặc giờ không hợp lệ." }, { status: 400 });
    }
    if (!await canUseCalendar(actor.id, actor.role, body.calendarId, true) || (update && !await canEditEvent(actor.id, actor.role, body.id))) {
      return NextResponse.json({ ok: false, error: "Không có quyền lưu sự kiện này." }, { status: 403 });
    }

    const allDay = Boolean(body.allDay);
    const startTime = allDay ? null : body.startTime || "08:00";
    const endTime = allDay ? null : body.endTime || null;
    const endDate = body.endDate || body.startDate;
    const eventDate = `${body.startDate} ${startTime || "00:00"}:00`;
    const type = body.type || "family";
    const status = body.status === "done" ? "done" : "open";
    const visibility = body.visibility || "all";
    const allowedMemberIds = JSON.stringify(body.allowedMemberIds || []);
    const relatedMemberIds = JSON.stringify(body.relatedMemberIds || []);

    const result = update
      ? await pool.query(
        `UPDATE events
         SET calendar_id=$2,title=$3,start_date=$4,start_time=$5,end_date=$6,end_time=$7,all_day=$8,is_all_day=$8,note=$9,description=$9,date=$4,time=$5,event_date=$10,label_color=$11,type=$12,location=$13,reminder_minutes=$14,repeat_rule=$15,status=$16,visibility=$17,allowed_member_ids=$18,related_member_ids=$19
         WHERE id=$1
         RETURNING id`,
        [body.id, body.calendarId, body.title.trim(), body.startDate, startTime, endDate, endTime, allDay, body.note || "", eventDate, body.labelColor || null, type, body.location || "", Number(body.reminderMinutes || 0), body.repeatRule || "none", status, visibility, allowedMemberIds, relatedMemberIds]
      )
      : await pool.query(
        `INSERT INTO events (id,calendar_id,title,start_date,start_time,end_date,end_time,all_day,is_all_day,note,description,created_by_user_id,date,time,event_date,color,type,label_color,location,reminder_minutes,repeat_rule,status,visibility,allowed_member_ids,related_member_ids)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$9,$10,$4,$5,$11,'#6366f1',$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING id`,
        [body.id, body.calendarId, body.title.trim(), body.startDate, startTime, endDate, endTime, allDay, body.note || "", actor.id, eventDate, type, body.labelColor || null, body.location || "", Number(body.reminderMinutes || 0), body.repeatRule || "none", status, visibility, allowedMemberIds, relatedMemberIds]
      );
    const eventId = result.rows[0].id;
    await pool.query("DELETE FROM event_members WHERE event_id=$1", [eventId]);
    for (const memberId of [...new Set(body.memberIds || [])]) {
      await pool.query("INSERT INTO event_members (event_id,member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [eventId, memberId]);
    }

    if (!update) {
       const title = `${actor.displayName || "Family Hub"} đã tạo sự kiện mới`;
       const message = `Sự kiện: ${body.title.trim()}`;
       await createSystemNotification({
         title,
         message,
         createdByName: actor.displayName || "Family Hub",
         userId: actor.id,
         sourceType: "event",
         sourceId: eventId
       });
    } else {
       const title = `${actor.displayName || "Family Hub"} đã cập nhật sự kiện`;
       const message = `Sự kiện: ${body.title.trim()}`;
       await createSystemNotification({
         title,
         message,
         createdByName: actor.displayName || "Family Hub",
         userId: actor.id,
         sourceType: "event",
         sourceId: eventId
       });
    }

    return NextResponse.json({ ok: true, data: { id: String(eventId) } }, { status: update ? 200 : 201 });
  } catch (error) {
    console.error("[SAVE /api/events]", error);
    return NextResponse.json({ ok: false, error: "Không thể lưu sự kiện." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) { return save(request, false); }
export async function PUT(request: NextRequest) { return save(request, true); }
export async function DELETE(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    await ensureEventSchema();
    const id = request.nextUrl.searchParams.get("id") || "";
    if (!id || !await canEditEvent(actor.id, actor.role, id)) return NextResponse.json({ ok: false, error: "Không có quyền xóa sự kiện." }, { status: 403 });
    
    // fetch title for notification before delete
    const eventRow = await pool.query("SELECT title FROM events WHERE id=$1", [id]);
    const eventTitle = eventRow.rows[0]?.title || "Sự kiện";

    await pool.query("DELETE FROM events WHERE id=$1", [id]);

    await createSystemNotification({
      title: `${actor.displayName || "Family Hub"} đã xóa sự kiện`,
      message: `Sự kiện: ${eventTitle}`,
      createdByName: actor.displayName || "Family Hub",
      userId: actor.id,
      sourceType: "event",
      sourceId: id
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/events]", error);
    return NextResponse.json({ ok: false, error: "Không thể xóa sự kiện." }, { status: 500 });
  }
}
