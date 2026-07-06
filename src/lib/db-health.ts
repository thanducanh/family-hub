import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const DATABASE_OFFLINE_CODE = "DATABASE_OFFLINE";
export const DATABASE_OFFLINE_MESSAGE = "Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại sau.";

export function databaseOfflineResponse(status = 503) {
  return NextResponse.json(
    { ok: false, code: DATABASE_OFFLINE_CODE, message: DATABASE_OFFLINE_MESSAGE },
    { status }
  );
}

export function isDatabaseConnectionError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = String((error as { code?: unknown }).code || "");
  const message = error instanceof Error ? error.message : String(error);
  return (
    code.startsWith("E") ||
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "57P01", "08000", "08003", "08006"].includes(code) ||
    /connection|connect|timeout|terminated|database|pool|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(message)
  );
}

export async function isDatabaseOnline() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function guardDatabaseWrite() {
  return (await isDatabaseOnline()) ? null : databaseOfflineResponse();
}

export function apiErrorResponse(error: unknown, fallbackMessage: string, routeLabel: string) {
  console.error(routeLabel, error);
  if (isDatabaseConnectionError(error)) return databaseOfflineResponse();
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : fallbackMessage }, { status: 500 });
}
