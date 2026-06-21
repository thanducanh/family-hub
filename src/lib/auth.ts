import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

export type UserRole = "full_access" | "self_only";
export interface SessionUser { id: string; username: string; displayName: string; avatar: string; coverUrl?: string; role: UserRole; mustChangePassword: boolean; memberId: string; }
interface SessionDetails extends SessionUser { expiresAt: number; }
const COOKIE_NAME = "family_hub_session";
const SHORT_SESSION_SECONDS = 60 * 60 * 8;
const REMEMBER_SESSION_SECONDS = 60 * 60 * 24 * 30;

function secret() {
  return process.env.SESSION_SECRET || "family-hub-change-this-secret";
}
function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}
export function normalizeUserRole(role: string): UserRole {
  return role === "full_access" || role === "system_admin" || role === "parent" || role === "admin" ? "full_access" : "self_only";
}
function createSessionTokenUntil(user: SessionUser, expiresAt: number) {
  // Avatar and coverUrl may be large data URLs. Keep the cookie small and hydrate profile data from members in API responses.
  const payload = Buffer.from(JSON.stringify({ ...user, avatar: "", coverUrl: "", expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export function createSessionToken(user: SessionUser, remember: boolean) {
  const maxAge = remember ? REMEMBER_SESSION_SECONDS : SHORT_SESSION_SECONDS;
  return createSessionTokenUntil(user, Date.now() + maxAge * 1000);
}
function readSessionDetails(token?: string): SessionDetails | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionDetails;
    if (value.expiresAt < Date.now()) return null;
    return value;
  } catch { return null; }
}
export function readSessionToken(token?: string): SessionUser | null {
  const value = readSessionDetails(token);
  return value && { id: value.id, username: value.username, displayName: value.displayName, avatar: value.avatar, coverUrl: value.coverUrl, role: normalizeUserRole(String(value.role)), mustChangePassword: value.mustChangePassword, memberId: value.memberId || "" };
}
export async function getSessionUser() {
  const reqHeaders = await headers();
  const authHeader = reqHeaders.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const user = readSessionToken(token);
    if (user) return user;
  }
  return readSessionToken((await cookies()).get(COOKIE_NAME)?.value);
}
export async function requireSession() {
  return Boolean(await getSessionUser());
}
export function sessionCookie(token: string, remember: boolean) {
  const maxAge = remember ? REMEMBER_SESSION_SECONDS : SHORT_SESSION_SECONDS;
  return { name: COOKIE_NAME, value: token, httpOnly: true, sameSite: "lax" as const, secure: process.env.COOKIE_SECURE === "true", path: "/", maxAge };
}
export function clearSessionCookie() {
  return { name: COOKIE_NAME, value: "", httpOnly: true, sameSite: "lax" as const, secure: process.env.COOKIE_SECURE === "true", path: "/", maxAge: 0 };
}
export async function refreshedSessionCookie(user: SessionUser) {
  const current = readSessionDetails((await cookies()).get(COOKIE_NAME)?.value);
  const expiresAt = current?.expiresAt ?? Date.now() + SHORT_SESSION_SECONDS * 1000;
  return { name: COOKIE_NAME, value: createSessionTokenUntil(user, expiresAt), httpOnly: true, sameSite: "lax" as const, secure: process.env.COOKIE_SECURE === "true", path: "/", maxAge: Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)) };
}

export function buildDataFilter(user: SessionUser | null, tablePrefix: string = '', paramIndexStart: number = 1, memberIdCol: string = 'member_id') {
  if (!user) return { where: '1=0', params: [] };
  const isAdmin = user.role === 'full_access';
  if (isAdmin) return { where: '1=1', params: [] };
  if (!user.memberId) return { where: '1=0', params: [] }; // Cannot see anything if no memberId and not admin
  const prefix = tablePrefix ? `${tablePrefix}.` : '';
  return { where: `${prefix}${memberIdCol} = $${paramIndexStart}`, params: [user.memberId] };
}
