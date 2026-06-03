import { readFile } from "node:fs/promises";

export async function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const content = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  const line = content.split(/\r?\n/).find((value) => value.trim().startsWith("DATABASE_URL="));
  if (!line) throw new Error("Không tìm thấy DATABASE_URL trong .env.local.");
  return line.slice(line.indexOf("=") + 1).trim();
}
