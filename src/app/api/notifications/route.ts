import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import crypto from "crypto";

export async function GET() {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    let query = `
      SELECT id, title, message, created_by_name as "createdByName", created_at as "createdAt",
             read_at as "readAt", is_read as "isRead", read_user_ids, user_id, visible_user_ids,
             source_type, source_id, metadata
      FROM notifications
      ORDER BY created_at DESC
    `;
    let params: unknown[] = [];
    if (actor.role !== "full_access") {
      query = `
        SELECT id, title, message, created_by_name as "createdByName", created_at as "createdAt",
               read_at as "readAt", is_read as "isRead", read_user_ids, user_id, visible_user_ids,
               source_type, source_id, metadata
        FROM notifications
        WHERE user_id = $1
           OR visible_user_ids::jsonb ? $1
           OR (user_id IS NULL AND (visible_user_ids IS NULL OR jsonb_array_length(visible_user_ids::jsonb) = 0))
        ORDER BY created_at DESC
      `;
      params = [actor.id];
    }

    const result = await pool.query(query, params);

    const data = result.rows.map(row => {
      let readUserIds: string[] = [];
      try {
        if (Array.isArray(row.read_user_ids)) {
          readUserIds = row.read_user_ids;
        } else if (typeof row.read_user_ids === "string") {
          readUserIds = JSON.parse(row.read_user_ids);
        } else if (row.read_user_ids && typeof row.read_user_ids === "object") {
          readUserIds = row.read_user_ids;
        }
      } catch {
        readUserIds = [];
      }
      const isRead = row.isRead || readUserIds.includes(actor.id);
      let metadata = null;
      try {
        if (row.metadata) {
          metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
        }
      } catch (e) {
        // ignore
      }
      return {
        id: row.id,
        title: row.title || row.message || "",
        message: row.message || "",
        createdByName: row.createdByName || "Family Hub",
        createdAt: row.createdAt,
        readAt: row.readAt,
        isRead: isRead,
        source_type: row.source_type,
        source_id: row.source_id,
        metadata
      };
    });

    return NextResponse.json({ ok: true, notifications: data });
  } catch (error) {
    console.error("[GET /api/notifications]", error);
    return NextResponse.json({ ok: false, error: "Không thể tải thông báo." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, title, message, createdByName, userId, visibleUserIds } = body;

    await pool.query(
      `INSERT INTO notifications (id, title, message, created_by_name, user_id, visible_user_ids)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        id || crypto.randomUUID(),
        title || message || "",
        message || "",
        createdByName || actor.displayName || "Family Hub",
        userId || null,
        JSON.stringify(visibleUserIds || [])
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/notifications]", error);
    return NextResponse.json({ ok: false, error: "Không thể tạo thông báo." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { id } = await request.json().catch(() => ({ id: null }));

    if (id) {
      await pool.query(
        `UPDATE notifications
         SET is_read = TRUE,
             read_at = CURRENT_TIMESTAMP,
             read_user_ids = CASE
               WHEN read_user_ids IS NULL THEN jsonb_build_array($1::text)
               WHEN read_user_ids::jsonb ? $1 THEN read_user_ids
               ELSE (read_user_ids::jsonb || jsonb_build_array($1::text))
             END
         WHERE id = $2`,
        [actor.id, id]
      );
    } else {
      let query = `
        UPDATE notifications
        SET is_read = TRUE,
            read_at = CURRENT_TIMESTAMP,
            read_user_ids = CASE
              WHEN read_user_ids IS NULL THEN jsonb_build_array($1::text)
              WHEN read_user_ids::jsonb ? $1 THEN read_user_ids
              ELSE (read_user_ids::jsonb || jsonb_build_array($1::text))
            END
      `;
      const params = [actor.id];
      if (actor.role !== "full_access") {
        query += `
          WHERE user_id = $1
             OR visible_user_ids::jsonb ? $1
             OR (user_id IS NULL AND (visible_user_ids IS NULL OR jsonb_array_length(visible_user_ids::jsonb) = 0))
        `;
      }
      await pool.query(query, params);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PUT /api/notifications]", error);
    return NextResponse.json({ ok: false, error: "Không thể cập nhật thông báo." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const id = request.nextUrl.searchParams.get("id");

    if (id) {
      if (actor.role === "full_access") {
        await pool.query("DELETE FROM notifications WHERE id = $1", [id]);
      } else {
        await pool.query(
          `DELETE FROM notifications 
           WHERE id = $1 AND (user_id = $2 OR visible_user_ids::jsonb ? $2)`,
          [id, actor.id]
        );
      }
    } else {
      if (actor.role === "full_access") {
        await pool.query("DELETE FROM notifications");
      } else {
        await pool.query(
          `DELETE FROM notifications 
           WHERE user_id = $1 OR visible_user_ids::jsonb ? $1`,
          [actor.id]
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/notifications]", error);
    return NextResponse.json({ ok: false, error: "Không thể xóa thông báo." }, { status: 500 });
  }
}
