import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const { user } = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const complexId = form.get("complexId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 10 MB" }, { status: 400 });
  }

  const admin = createAdminClient();
  await ensureProfile(admin, user.id, user.email);

  if (complexId && typeof complexId === "string") {
    const { data: complex } = await admin
      .from("complexes")
      .select("id")
      .eq("id", complexId)
      .maybeSingle();
    if (!complex) {
      return NextResponse.json({ error: "Building not found" }, { status: 404 });
    }
  }

  const submissionId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const storagePath = `${user.id}/${submissionId}-${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from("dhcr-uploads")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        error:
          uploadError.message.includes("Bucket")
            ? "Storage not configured — run migration 20260608000001_dhcr_and_review_flags.sql"
            : uploadError.message,
      },
      { status: 500 }
    );
  }

  const { error: rowError } = await admin.from("dhcr_submissions").insert({
    id: submissionId,
    user_id: user.id,
    complex_id:
      typeof complexId === "string" && complexId.length > 0 ? complexId : null,
    storage_path: storagePath,
    file_name: file.name,
    status: "pending",
  });

  if (rowError) {
    await admin.storage.from("dhcr-uploads").remove([storagePath]);
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    submissionId,
    message:
      "DHCR document received. We'll parse rent history and email you when your overcharge check is ready.",
  });
}
