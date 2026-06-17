import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { sendPushNotification } from "@/lib/server-notifications";

export async function POST(req: Request) {
  try {
    const actor = await getSessionUser();
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Send a test notification to the user themselves
    await sendPushNotification([actor.id], {
      title: "Family Hub",
      body: "Đây là thông báo thử nghiệm từ hệ thống!",
      data: { url: "/?screen=notifications" }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending test push:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
