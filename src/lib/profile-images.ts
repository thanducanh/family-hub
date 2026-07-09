import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { refreshedSessionCookie, type SessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { ensureMemberAvatarUrlColumn, memberProfileFields, toMemberProfile } from "@/lib/member-profile";
import { ensureUserAvatarUrlColumn } from "@/lib/user-admin";

const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export type ProfileImageKind = "avatar" | "cover";

export function validateProfileImage(file: File | null) {
  if (!file) return "Chua chon anh.";
  if (!ALLOWED_PROFILE_IMAGE_TYPES.has(file.type)) return "Chi ho tro anh jpg, jpeg, png hoac webp.";
  if (file.size > MAX_PROFILE_IMAGE_BYTES) return "Anh qua lon. Vui long chon anh toi da 5MB.";
  return "";
}

function safeUserId(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80) || "user";
}

function publicUploadPathToDisk(imageUrl: string) {
  if (!imageUrl || imageUrl.startsWith("data:image") || !imageUrl.startsWith("/uploads/profile/")) return null;
  const filename = path.basename(imageUrl);
  return path.join(process.cwd(), "public", "uploads", "profile", filename);
}

export async function deleteLocalProfileImage(imageUrl: string) {
  const diskPath = publicUploadPathToDisk(imageUrl);
  if (!diskPath) return;
  try {
    await unlink(diskPath);
  } catch (error) {
    if ((error as { code?: string })?.code !== "ENOENT") console.warn("[deleteLocalProfileImage]", error);
  }
}

export async function saveProfileImageFile(file: File, kind: ProfileImageKind, userId: string) {
  const extension = ALLOWED_PROFILE_IMAGE_TYPES.get(file.type) || "jpg";
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeId = `${safeUserId(userId)}-${Date.now()}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "profile");
  const filename = `${kind}-${safeId}.${extension}`;
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);
  return `/uploads/profile/${filename}`;
}

export async function setProfileImage(session: SessionUser, kind: ProfileImageKind, imageUrl: string) {
  await ensureUserAvatarUrlColumn();
  if (session.memberId) {
    await ensureMemberAvatarUrlColumn();
    const current = await pool.query("SELECT avatar, avatar_url, cover_url FROM members WHERE id=$1 AND deleted_at IS NULL", [session.memberId]);
    const oldUrl = kind === "avatar" ? current.rows[0]?.avatar_url || current.rows[0]?.avatar || "" : current.rows[0]?.cover_url || "";
    if (kind === "avatar") {
      await pool.query("UPDATE members SET avatar=$2, avatar_url=$2 WHERE id=$1 AND deleted_at IS NULL", [session.memberId, imageUrl]);
    } else {
      await pool.query("UPDATE members SET cover_url=$2 WHERE id=$1 AND deleted_at IS NULL", [session.memberId, imageUrl]);
    }
    await pool.query("UPDATE users SET updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id]);
    await deleteLocalProfileImage(oldUrl);
  } else if (kind === "avatar") {
    const current = await pool.query("SELECT avatar, avatar_url FROM users WHERE id=$1", [session.id]);
    const oldUrl = current.rows[0]?.avatar_url || current.rows[0]?.avatar || "";
    await pool.query("UPDATE users SET avatar=$2, avatar_url=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id, imageUrl]);
    await deleteLocalProfileImage(oldUrl);
  } else {
    const current = await pool.query("SELECT cover_url FROM users WHERE id=$1", [session.id]);
    const oldUrl = current.rows[0]?.cover_url || "";
    await pool.query("UPDATE users SET cover_url=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id, imageUrl]);
    await deleteLocalProfileImage(oldUrl);
  }
}

export async function clearProfileImage(session: SessionUser, kind: ProfileImageKind) {
  await ensureUserAvatarUrlColumn();
  if (session.memberId) {
    await ensureMemberAvatarUrlColumn();
    const current = await pool.query("SELECT avatar, avatar_url, cover_url FROM members WHERE id=$1 AND deleted_at IS NULL", [session.memberId]);
    const oldUrl = kind === "avatar" ? current.rows[0]?.avatar_url || current.rows[0]?.avatar || "" : current.rows[0]?.cover_url || "";
    if (kind === "avatar") {
      await pool.query("UPDATE members SET avatar='', avatar_url=NULL WHERE id=$1 AND deleted_at IS NULL", [session.memberId]);
    } else {
      await pool.query("UPDATE members SET cover_url=NULL WHERE id=$1 AND deleted_at IS NULL", [session.memberId]);
    }
    await pool.query("UPDATE users SET updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id]);
    await deleteLocalProfileImage(oldUrl);
  } else if (kind === "avatar") {
    const current = await pool.query("SELECT avatar, avatar_url FROM users WHERE id=$1", [session.id]);
    const oldUrl = current.rows[0]?.avatar_url || current.rows[0]?.avatar || "";
    await pool.query("UPDATE users SET avatar='', avatar_url=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id]);
    await deleteLocalProfileImage(oldUrl);
  } else {
    const current = await pool.query("SELECT cover_url FROM users WHERE id=$1", [session.id]);
    const oldUrl = current.rows[0]?.cover_url || "";
    await pool.query("UPDATE users SET cover_url=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id]);
    await deleteLocalProfileImage(oldUrl);
  }
}

export async function buildProfileImageResponse(session: SessionUser, kind: ProfileImageKind, imageUrl: string) {
  let member = null;
  let account = null;
  await ensureUserAvatarUrlColumn();
  const accountResult = await pool.query("SELECT id, username, display_name, avatar, avatar_url, cover_url, role, must_change_password, member_id FROM users WHERE id=$1", [session.id]);
  account = accountResult.rows[0] || null;
  if (session.memberId) {
    await ensureMemberAvatarUrlColumn();
    const result = await pool.query(`SELECT ${memberProfileFields} FROM members WHERE id=$1 AND deleted_at IS NULL`, [session.memberId]);
    member = result.rows[0] ? toMemberProfile(result.rows[0]) : null;
  }

  const avatarUrl = member?.avatarUrl || account?.avatar_url || account?.avatar || "";
  const coverUrl = member?.coverUrl || account?.cover_url || "";
  const nextUser = {
    id: session.id,
    username: session.username,
    displayName: member?.name || account?.display_name || session.displayName,
    memberName: member?.name || "",
    avatarUrl,
    coverUrl,
    role: session.role,
    memberId: member?.id || session.memberId || "",
    mustChangePassword: session.mustChangePassword,
  };
  const response = NextResponse.json({ ok: true, imageUrl, avatarUrl, coverUrl, user: nextUser, member });
  response.cookies.set(await refreshedSessionCookie({ ...session, avatar: avatarUrl, coverUrl }));
  return response;
}
