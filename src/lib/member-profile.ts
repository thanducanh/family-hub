import { pool } from "@/lib/db";
import { fixVietnameseMojibakeString, fixVietnameseMojibake } from "@/lib/text-encoding";

export interface MemberProfile {
  id: string;
  name: string;
  nickname: string;
  avatar: string;
  avatarUrl?: string;
  avatarPreview?: string;
  coverUrl?: string;
  phone: string;
  birthday: string;
  gender: string;
  notes: string;
  color: string;
  permissions?: Record<string, unknown>;
}

export const memberProfileFields = "id, name, nickname, avatar, avatar_url, cover_url, phone, birthday, gender, notes, color, permissions";

export async function ensureMemberAvatarUrlColumn() {
  await pool.query("ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_url TEXT");
  await pool.query("ALTER TABLE members ADD COLUMN IF NOT EXISTS cover_url TEXT");
  await pool.query("ALTER TABLE members ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query("UPDATE members SET avatar_url = avatar WHERE (avatar_url IS NULL OR avatar_url = '') AND avatar IS NOT NULL AND avatar <> ''");
}

export function durableAvatarValue(value: unknown, fallbackAvatar = "") {
  if (value === undefined || value === null) return fallbackAvatar;
  const avatar = String(value).trim();
  if (!avatar || avatar.startsWith("blob:")) return fallbackAvatar;
  return avatar;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function normalizeBirthday(value: unknown) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return validDate(text) ? text : "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function toMemberProfile(row: Record<string, unknown>): MemberProfile {
  const permissions = fixVietnameseMojibake(row.permissions);
  return {
    id: String(row.id),
    name: fixVietnameseMojibakeString(row.name),
    nickname: fixVietnameseMojibakeString(row.nickname),
    avatar: String(row.avatar_url ?? row.avatar ?? ""),
    avatarUrl: String(row.avatar_url ?? row.avatar ?? ""),
    avatarPreview: row.avatarPreview !== undefined ? String(row.avatarPreview) : undefined,
    coverUrl: String(row.cover_url ?? ""),
    phone: fixVietnameseMojibakeString(row.phone),
    birthday: normalizeBirthday(row.birthday),
    gender: fixVietnameseMojibakeString(row.gender),
    notes: fixVietnameseMojibakeString(row.notes),
    color: String(row.color ?? ""),
    permissions: typeof permissions === "object" && permissions !== null ? permissions as Record<string, unknown> : {},
  };
}
