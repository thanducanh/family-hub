export interface MemberProfile {
  id: string;
  name: string;
  nickname: string;
  avatar: string;
  phone: string;
  birthday: string;
  gender: string;
  notes: string;
  role: string;
  color: string;
}

export const memberProfileFields = "id, name, nickname, avatar, phone, birthday, gender, notes, role, color";

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
    avatar: String(row.avatar ?? ""),
    phone: String(row.phone ?? ""),
    birthday: normalizeBirthday(row.birthday),
    gender: String(row.gender ?? ""),
    notes: String(row.notes ?? ""),
    role: String(row.role ?? ""),
    color: String(row.color ?? ""),
  };
}
