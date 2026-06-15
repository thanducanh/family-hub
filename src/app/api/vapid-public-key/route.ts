import { NextResponse } from "next/server";
import { getVapidKeys } from "@/lib/webpush";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const keys = await getVapidKeys();
    return NextResponse.json({ publicKey: keys.publicKey });
  } catch (error) {
    console.error("Error getting VAPID keys:", error);
    return NextResponse.json({ error: "Failed to get VAPID keys" }, { status: 500 });
  }
}
