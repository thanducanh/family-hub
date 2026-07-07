import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCardUsageDuration(openedAt?: string | null): string {
  if (!openedAt) return "Chưa cập nhật";
  const date = new Date(openedAt);
  if (isNaN(date.getTime())) return "Chưa cập nhật";
  const now = new Date();
  let months = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
  if (now.getDate() < date.getDate()) months--;
  if (months <= 0) return "Dưới 1 tháng";
  if (months < 12) return months + " tháng";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? y + " năm" : y + " năm " + m + " tháng";
}

export function parseVNDateToISO(value: string): string | null {
  if (!value) return null;
  const val = value.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return null;
  const parts = val.split("/");
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  
  const dateObj = new Date(y, m - 1, d);
  if (dateObj.getFullYear() !== y || dateObj.getMonth() + 1 !== m || dateObj.getDate() !== d) {
    return null;
  }
  
  const yStr = String(y).padStart(4, "0");
  const mStr = String(m).padStart(2, "0");
  const dStr = String(d).padStart(2, "0");
  return `${yStr}-${mStr}-${dStr}`;
}

export function formatISODateToVN(value: string | Date | null | undefined): string {
  if (!value) return "";
  // Check if value is YYYY-MM-DD
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const parts = value.split("T")[0].split("-");
    if (parts.length >= 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  const dateObj = typeof value === "string" ? new Date(value) : value;
  if (isNaN(dateObj.getTime())) return "";
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  const yStr = String(y).padStart(4, "0");
  const mStr = String(m).padStart(2, "0");
  const dStr = String(d).padStart(2, "0");
  return `${dStr}/${mStr}/${yStr}`;
}

export function isValidVNDate(value: string): boolean {
  if (!value) return true;
  return parseVNDateToISO(value) !== null;
}
