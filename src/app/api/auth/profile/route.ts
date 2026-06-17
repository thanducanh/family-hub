import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, refreshedSessionCookie, type SessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { durableAvatarValue, ensureMemberAvatarUrlColumn, memberProfileFields, toMemberProfile, type MemberProfile } from "@/lib/member-profile";
import { toPublicUser, ensureUserAvatarUrlColumn, type PublicUser } from "@/lib/user-admin";

const select = "id, username, email, display_name, avatar, role, active, must_change_password, is_system, member_id, created_at, updated_at";
type ProfileBody = Partial<MemberProfile> & { displayName?: string; email?: string; memberId?: string; avatarUrl?: string };
type ProfileUser = PublicUser & { member?: MemberProfile };

async function loadProfile(userId: string): Promise<ProfileUser | null> {
  let result = await pool.query(`SELECT ${select} FROM users WHERE id = $1`, [userId]);
  if (!result.rows[0]) return null;
  const profile: ProfileUser = toPublicUser(result.rows[0]);
  
  // Also try to read avatar_url safely
  try {
    const avResult = await pool.query("SELECT avatar_url FROM users WHERE id = $1", [userId]);
    if (avResult.rows[0]?.avatar_url) profile.avatar = avResult.rows[0].avatar_url;
  } catch (e) {
    // Column might not exist yet, ignore
  }

  if (!profile.memberId) return profile;
  await ensureMemberAvatarUrlColumn();
  const memberResult = await pool.query(`SELECT ${memberProfileFields} FROM members WHERE id = $1 AND deleted_at IS NULL`, [profile.memberId]);
  if (!memberResult.rows[0]) return profile;
  const member = toMemberProfile(memberResult.rows[0]);
  return { ...profile, displayName: member.name || profile.displayName, avatar: member.avatarUrl || member.avatar || profile.avatar, member };
}

async function assignOwnMember(session: SessionUser, memberId: string) {
  if (session.role !== "full_access") throw new Error("Bạn không có quyền tự liên kết thành viên.");
  const member = await pool.query("SELECT id FROM members WHERE id = $1 AND deleted_at IS NULL", [memberId]);
  if (!member.rows[0]) throw new Error("Không tìm thấy thành viên để liên kết.");
  const used = await pool.query("SELECT id FROM users WHERE member_id = $1 AND id <> $2", [memberId, session.id]);
  if (used.rows[0]) throw new Error("Thành viên này đã được liên kết với tài khoản khác.");
  await pool.query("UPDATE users SET member_id=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id, memberId]);
  session.memberId = memberId;
}

function sessionFrom(profile: ProfileUser): SessionUser {
  return { id: profile.id, username: profile.username, displayName: profile.displayName, avatar: profile.avatar, role: profile.role, mustChangePassword: profile.mustChangePassword, memberId: profile.memberId };
}

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    const profile = await loadProfile(session.id);
    return profile ? NextResponse.json({ ok: true, user: profile, member: profile.member ?? null }) : NextResponse.json({ ok: false, error: "Không tìm thấy tài khoản." }, { status: 404 });
  } catch (error) {
    console.error("[GET /api/auth/profile]", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    const body = await request.json() as ProfileBody;
    if (!session.memberId && body.memberId) await assignOwnMember(session, body.memberId);
    if (session.memberId) {
      if (!body.name?.trim()) return NextResponse.json({ ok: false, error: "Họ tên không được để trống." }, { status: 400 });
      await ensureMemberAvatarUrlColumn();
      const current = await pool.query("SELECT avatar, avatar_url FROM members WHERE id=$1 AND deleted_at IS NULL", [session.memberId]);
      const currentAvatar = current.rows[0]?.avatar_url || current.rows[0]?.avatar || "";
      const avatar = durableAvatarValue(body.avatarUrl ?? body.avatar, currentAvatar);
      await pool.query("UPDATE members SET name=$2,nickname=$3,phone=$4,birthday=$5,gender=$6,avatar=$7,avatar_url=$8,notes=$9 WHERE id=$1 AND deleted_at IS NULL", [session.memberId, body.name.trim(), body.nickname?.trim() || "", body.phone?.trim() || "", body.birthday || null, body.gender?.trim() || "", avatar, avatar, body.notes?.trim() || ""]);
      await pool.query("UPDATE users SET email=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id, body.email?.trim() || null]);
    } else {
      if (!body.displayName?.trim()) return NextResponse.json({ ok: false, error: "Tên hiển thị không được để trống." }, { status: 400 });
      await ensureUserAvatarUrlColumn();
      const current = await pool.query("SELECT avatar, avatar_url FROM users WHERE id=$1", [session.id]);
      const currentAvatar = current.rows[0]?.avatar_url || current.rows[0]?.avatar || "";
      const avatar = durableAvatarValue(body.avatarUrl ?? body.avatar, currentAvatar);
      await pool.query("UPDATE users SET display_name=$2,email=$3,avatar=$4,avatar_url=$5,updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id, body.displayName.trim(), body.email?.trim() || null, avatar, avatar]);
    }
    const profile = await loadProfile(session.id);
    if (!profile) return NextResponse.json({ ok: false, error: "Không tìm thấy tài khoản." }, { status: 404 });
    const user = sessionFrom(profile);
    const response = NextResponse.json({ ok: true, data: profile, profile, user, member: profile.member ?? null });
    response.cookies.set(await refreshedSessionCookie(user));
    return response;
  } catch (error) {
    console.error("[PUT /api/auth/profile]", error);
    const message = error instanceof Error ? error.message : "Lỗi máy chủ. Vui lòng thử lại.";
    return NextResponse.json({ ok: false, error: message }, { status: message.startsWith("Lỗi máy chủ") ? 500 : 400 });
  }
}
