import { pool } from "@/lib/db";

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
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    nickname: String(row.nickname ?? ""),
    avatar: String(row.avatar_url ?? row.avatar ?? ""),
    avatarUrl: String(row.avatar_url ?? row.avatar ?? ""),
    avatarPreview: row.avatarPreview !== undefined ? String(row.avatarPreview) : undefined,
    coverUrl: String(row.cover_url ?? ""),
    phone: String(row.phone ?? ""),
    birthday: normalizeBirthday(row.birthday),
    gender: String(row.gender ?? ""),
    notes: String(row.notes ?? ""),
    color: String(row.color ?? ""),
    permissions: typeof row.permissions === "object" && row.permissions !== null ? row.permissions as Record<string, unknown> : {},
  };
}
