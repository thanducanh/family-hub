import { normalizeUserRole, type SessionUser, type UserRole } from "@/lib/auth";

export interface PublicUser {
  id: string; username: string; email: string; displayName: string; avatar: string; role: UserRole;
  active: boolean; mustChangePassword: boolean; isSystem: boolean; memberId: string; createdAt: string; updatedAt: string;
}
export function toPublicUser(row: Record<string, unknown>): PublicUser {
  return { id: String(row.id), username: String(row.username), email: String(row.email ?? ""), displayName: String(row.display_name), avatar: String(row.avatar ?? ""), role: normalizeUserRole(String(row.role)), active: Boolean(row.active), mustChangePassword: Boolean(row.must_change_password), isSystem: Boolean(row.is_system), memberId: String(row.member_id ?? ""), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
export function canManage(actor: SessionUser, targetRole: UserRole) {
  return actor.role === "full_access" && (targetRole === "full_access" || targetRole === "self_only");
}
