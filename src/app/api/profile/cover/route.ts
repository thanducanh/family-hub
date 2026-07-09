import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildProfileImageResponse, clearProfileImage, saveProfileImageFile, setProfileImage, validateProfileImage } from "@/lib/profile-images";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, error: "Chua dang nhap." }, { status: 401 });
    const form = await request.formData();
    const file = form.get("file");
    const error = validateProfileImage(file instanceof File ? file : null);
    if (error) return NextResponse.json({ ok: false, error }, { status: 400 });
    const imageUrl = await saveProfileImageFile(file as File, "cover");
    await setProfileImage(session, "cover", imageUrl);
    return buildProfileImageResponse(session, "cover", imageUrl);
  } catch (error) {
    console.error("[POST /api/profile/cover]", error);
    return NextResponse.json({ ok: false, error: "Loi may chu. Vui long thu lai." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ ok: false, error: "Chua dang nhap." }, { status: 401 });
    await clearProfileImage(session, "cover");
    return buildProfileImageResponse(session, "cover", "");
  } catch (error) {
    console.error("[DELETE /api/profile/cover]", error);
    return NextResponse.json({ ok: false, error: "Loi may chu. Vui long thu lai." }, { status: 500 });
  }
}
