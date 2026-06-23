import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";

const MODULE_KEYS = ["finance", "calendar", "tasks", "notes", "members", "stats", "settings"] as const;
const VIEW_MODES = ["self_only", "all", "custom"] as const;

type PermissionPayload = {
  modules?: Record<string, unknown>;
  viewMode?: string;
  visibleMemberIds?: unknown;
};

function normalizePermissions(payload: PermissionPayload) {
  const modules = Object.fromEntries(MODULE_KEYS.map(key => [key, payload.modules?.[key] !== false]));
  const viewMode = VIEW_MODES.includes(payload.viewMode as any) ? payload.viewMode : "self_only";
  const visibleMemberIds = Array.isArray(payload.visibleMemberIds)
    ? payload.visibleMemberIds.map(String).filter(Boolean)
    : [];
  return { modules, viewMode, visibleMemberIds };
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (actor.role !== "full_access") return NextResponse.json({ ok: false, error: "Khong co quyen cap nhat phan quyen." }, { status: 403 });

    const { id } = await context.params;
    if (!id) return NextResponse.json({ ok: false, error: "Thieu member id." }, { status: 400 });

    const body = await request.json() as PermissionPayload;
    const permissions = normalizePermissions(body);

    await pool.query("ALTER TABLE members ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb");
    const result = await pool.query(
      "UPDATE members SET permissions = $2::jsonb WHERE id = $1 AND deleted_at IS NULL RETURNING id, name, permissions",
      [id, JSON.stringify(permissions)]
    );
    const member = result.rows[0];
    if (!member) return NextResponse.json({ ok: false, error: "Khong tim thay thanh vien." }, { status: 404 });

    return NextResponse.json({ ok: true, member: { id: member.id, name: member.name, permissions: member.permissions } });
  } catch (error) {
    console.error("[PUT /api/member-permissions/[id]]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Khong the luu phan quyen." }, { status: 500 });
  }
}
