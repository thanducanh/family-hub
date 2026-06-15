import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const subscription = await req.json();
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys.p256dh;
    const auth = subscription.keys.auth;

    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE 
       SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [actor.id, endpoint, p256dh, auth]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving push subscription:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });

    await pool.query(
      "DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2",
      [endpoint, actor.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting push subscription:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
