import { mkdir, writeFile } from "fs/promises";
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

export async function saveProfileImageFile(file: File, kind: ProfileImageKind) {
  const extension = ALLOWED_PROFILE_IMAGE_TYPES.get(file.type) || "jpg";
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
    if (kind === "avatar") {
      await pool.query("UPDATE members SET avatar=$2, avatar_url=$2 WHERE id=$1 AND deleted_at IS NULL", [session.memberId, imageUrl]);
    } else {
      await pool.query("UPDATE members SET cover_url=$2 WHERE id=$1 AND deleted_at IS NULL", [session.memberId, imageUrl]);
    }
    await pool.query("UPDATE users SET updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id]);
  } else if (kind === "avatar") {
    await pool.query("UPDATE users SET avatar=$2, avatar_url=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id, imageUrl]);
  } else {
    await pool.query("UPDATE users SET cover_url=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id, imageUrl]);
  }
}

export async function clearProfileImage(session: SessionUser, kind: ProfileImageKind) {
  await ensureUserAvatarUrlColumn();
  if (session.memberId) {
    await ensureMemberAvatarUrlColumn();
    if (kind === "avatar") {
      await pool.query("UPDATE members SET avatar='', avatar_url='' WHERE id=$1 AND deleted_at IS NULL", [session.memberId]);
    } else {
      await pool.query("UPDATE members SET cover_url='' WHERE id=$1 AND deleted_at IS NULL", [session.memberId]);
    }
    await pool.query("UPDATE users SET updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id]);
  } else if (kind === "avatar") {
    await pool.query("UPDATE users SET avatar='', avatar_url='', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id]);
  } else {
    await pool.query("UPDATE users SET cover_url='', updated_at=CURRENT_TIMESTAMP WHERE id=$1", [session.id]);
  }
}

export async function buildProfileImageResponse(session: SessionUser, kind: ProfileImageKind, imageUrl: string) {
  let member = null;
  if (session.memberId) {
    await ensureMemberAvatarUrlColumn();
    const result = await pool.query(`SELECT ${memberProfileFields} FROM members WHERE id=$1 AND deleted_at IS NULL`, [session.memberId]);
    member = result.rows[0] ? toMemberProfile(result.rows[0]) : null;
  }

  const nextUser = {
    ...session,
    avatar: kind === "avatar" ? imageUrl : session.avatar,
    coverUrl: kind === "cover" ? imageUrl : session.coverUrl || "",
  };
  const response = NextResponse.json({ ok: true, imageUrl, avatarUrl: kind === "avatar" ? imageUrl : undefined, coverUrl: kind === "cover" ? imageUrl : undefined, user: nextUser, member });
  response.cookies.set(await refreshedSessionCookie(nextUser));
  return response;
}
