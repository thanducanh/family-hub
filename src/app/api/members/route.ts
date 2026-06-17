import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { durableAvatarValue, ensureMemberAvatarUrlColumn, normalizeBirthday, toMemberProfile } from "@/lib/member-profile";

const fields = "id, name, nickname, birthday, gender, phone, avatar, avatar_url, notes, color";

function toDate(value: unknown) {
  return normalizeBirthday(value) || null;
}
function isValidBirthday(value: unknown) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
export function memberResponse(row: Record<string, unknown>) {
  return toMemberProfile(row);
}
function values(item: Record<string, unknown>, fallbackAvatar = "") {
  const rawAvatar = item.avatarUrl ?? item.avatar_url ?? item.avatar;
  const avatar = durableAvatarValue(rawAvatar, fallbackAvatar);
  return [item.id, item.name, item.nickname || "", toDate(item.birthday), item.gender || "", item.phone || "", avatar, avatar, item.notes || "", item.color || "#fb7185"];
}
async function linkedMemberId(userId: string) {
  return (await pool.query("SELECT member_id FROM users WHERE id = $1", [userId])).rows[0]?.member_id as string | null | undefined;
}

export async function GET(request: NextRequest) {
  const actor = await getSessionUser();
  if (!actor) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  await ensureMemberAvatarUrlColumn();
  
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const result = await pool.query(`SELECT ${fields} FROM members WHERE id = $1 AND deleted_at IS NULL`, [id]);
    const member = result.rows[0];
    if (!member) return NextResponse.json({ ok: false, error: "Không tìm thấy thành viên." }, { status: 404 });
    return NextResponse.json({ ok: true, data: memberResponse(member) });
  }

  if (actor.role === "self_only") {
    const memberId = await linkedMemberId(actor.id);
    if (!memberId) return NextResponse.json({ ok: true, data: [] });
    const result = await pool.query(`SELECT ${fields} FROM members WHERE id = $1 AND deleted_at IS NULL`, [memberId]);
    const list = result.rows.map(row => memberResponse(row));
    return NextResponse.json({ ok: true, data: list });
  }
  const result = await pool.query(`SELECT ${fields} FROM members WHERE deleted_at IS NULL ORDER BY name`);
  const accounts = await pool.query("SELECT id, username, email, display_name, role, active, is_system, member_id, created_at, updated_at FROM users WHERE member_id IS NOT NULL");
  const accountByMember = new Map(accounts.rows.map(account => [String(account.member_id), {
    id: String(account.id), username: String(account.username), email: String(account.email ?? ""), displayName: String(account.display_name),
    role: String(account.role), active: Boolean(account.active), isSystem: Boolean(account.is_system), memberId: String(account.member_id),
    createdAt: String(account.created_at), updatedAt: String(account.updated_at),
  }]));
  const list = result.rows.map(row => {
    const m = memberResponse(row);
    return { ...m, user: accountByMember.get(m.id) ?? null };
  });
  return NextResponse.json({ ok: true, data: list });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    await ensureMemberAvatarUrlColumn();
    if (actor.role === "self_only") return NextResponse.json({ ok: false, error: "Không có quyền thêm thành viên." }, { status: 403 });
    const item = await request.json() as Record<string, unknown>;
    const birthday = item.birthDate || item.birthday;
    const notes = item.note || item.notes;
    const normalized: Record<string, unknown> = { ...item, birthday, notes };
    if (!normalized.id || !normalized.name || (normalized.birthday && !isValidBirthday(normalized.birthday))) return NextResponse.json({ ok: false, error: "Họ tên và ngày sinh phải hợp lệ." }, { status: 400 });
    const result = await pool.query(`INSERT INTO members (id, name, nickname, birthday, gender, phone, avatar, avatar_url, notes, color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${fields}`, values(normalized));
    const member = memberResponse(result.rows[0]);
    return NextResponse.json({ ok: true, data: member, member }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/members]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể lưu thành viên." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    await ensureMemberAvatarUrlColumn();
    const item = await request.json() as Record<string, unknown>;
    const normalized: Record<string, unknown> = { ...item, birthday: item.birthDate || item.birthday, notes: item.note || item.notes };
    if (!normalized.id) return NextResponse.json({ ok: false, error: "Thiếu id." }, { status: 400 });
    
    // Fetch current avatar from DB to keep it if new payload does not contain it.
    const currentRes = await pool.query("SELECT avatar, avatar_url FROM members WHERE id = $1 AND deleted_at IS NULL", [normalized.id]);
    const currentAvatar = currentRes.rows[0]?.avatar_url || currentRes.rows[0]?.avatar || "";

    if (actor.role === "self_only") {
      const memberId = await linkedMemberId(actor.id);
      if (!memberId || memberId !== normalized.id) return NextResponse.json({ ok: false, error: "Không có quyền sửa thành viên này." }, { status: 403 });
      
      const rawAvatar = normalized.avatarUrl ?? normalized.avatar_url ?? normalized.avatar;
      const avatar = durableAvatarValue(rawAvatar, currentAvatar);
      const result = await pool.query(`UPDATE members SET nickname=$2, phone=$3, avatar=$4, avatar_url=$5, notes=$6 WHERE id = $1 RETURNING ${fields}`, [normalized.id, normalized.nickname || "", normalized.phone || "", avatar, avatar, normalized.notes || ""]);
      const member = result.rows[0] && memberResponse(result.rows[0]);
      return member ? NextResponse.json({ ok: true, data: member, member }) : NextResponse.json({ ok: false, error: "Không tìm thấy thành viên." }, { status: 404 });
    }
    if (!normalized.name || (normalized.birthday && !isValidBirthday(normalized.birthday))) return NextResponse.json({ ok: false, error: "Họ tên và ngày sinh phải hợp lệ." }, { status: 400 });
    const result = await pool.query(`UPDATE members SET name=$2,nickname=$3,birthday=$4,gender=$5,phone=$6,avatar=$7,avatar_url=$8,notes=$9,color=$10 WHERE id=$1 RETURNING ${fields}`, values(normalized, currentAvatar));
    const member = result.rows[0] && memberResponse(result.rows[0]);
    return member ? NextResponse.json({ ok: true, data: member, member }) : NextResponse.json({ ok: false, error: "Không tìm thấy thành viên." }, { status: 404 });
  } catch (error) {
    console.error("[PUT /api/members]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể lưu thành viên." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (actor.role === "self_only") return NextResponse.json({ ok: false, error: "Không có quyền xóa thành viên." }, { status: 403 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Thiếu id." }, { status: 400 });
    const linkedUser = await pool.query("SELECT is_system FROM users WHERE member_id = $1", [id]);
    if (linkedUser.rows.some(user => user.is_system)) return NextResponse.json({ ok: false, error: "Không thể xóa thành viên đang liên kết với tài khoản hệ thống." }, { status: 403 });
    const related = await pool.query(`SELECT
    (SELECT COUNT(*) FROM tasks WHERE member_id=$1) +
    (SELECT COUNT(*) FROM transactions WHERE member_id=$1) +
    (SELECT COUNT(*) FROM events WHERE member_id=$1) +
    (SELECT COUNT(*) FROM notes WHERE member_id=$1) AS count`, [id]);
    const relatedCount = Number(related.rows[0]?.count || 0);
    await pool.query("UPDATE members SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
    return NextResponse.json({ ok: true, data: { deleted: true, relatedCount } });
  } catch (error) {
    console.error("[DELETE /api/members]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Không thể ẩn thành viên." }, { status: 500 });
  }
}
