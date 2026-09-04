import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseDhcrPdf } from "@/lib/dhcr-parse";

export const runtime = "nodejs";

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
            ? "Storage not configured. Run migration 20260608000001_dhcr_and_review_flags.sql"
            : uploadError.message,
      },
      { status: 500 }
    );
  }

  let parsed = null;
  let parse_error: string | null = null;
  let status: "pending" | "parsed" | "failed" = "pending";

  try {
    parsed = await parseDhcrPdf(buffer);
    status = "parsed";
  } catch (e) {
    parse_error = e instanceof Error ? e.message : "Could not read PDF text";
    status = "failed";
  }

  const { error: rowError } = await admin.from("dhcr_submissions").insert({
    id: submissionId,
    user_id: user.id,
    complex_id:
      typeof complexId === "string" && complexId.length > 0 ? complexId : null,
    storage_path: storagePath,
    file_name: file.name,
    status,
    parsed_data: parsed,
    parse_error,
    parsed_at: parsed ? new Date().toISOString() : null,
  });

  if (rowError) {
    await admin.storage.from("dhcr-uploads").remove([storagePath]);
    return NextResponse.json({ error: rowError.message }, { status: 500 });
  }

  const linkedComplexId =
    typeof complexId === "string" && complexId.length > 0 ? complexId : null;

  if (linkedComplexId && parsed) {
    const withBedroom = (parsed.bedroom_rents ?? []).filter(
      (r) => r.bedrooms != null
    );
    const byBedroom = new Map<number, number>();
    for (const row of withBedroom) {
      if (row.bedrooms == null || byBedroom.has(row.bedrooms)) continue;
      byBedroom.set(row.bedrooms, Math.round(row.amount));
    }

    if (byBedroom.size > 0) {
      await admin.from("pricing_history").insert(
        Array.from(byBedroom.entries()).map(([bedrooms, rent]) => ({
          complex_id: linkedComplexId,
          rent,
          bedrooms,
          user_id: user.id,
          is_anonymous: true,
        }))
      );
    } else if (parsed.suggested_legal_rent) {
      await admin.from("pricing_history").insert({
        complex_id: linkedComplexId,
        rent: Math.round(parsed.suggested_legal_rent),
        user_id: user.id,
        is_anonymous: true,
      });
    }
  }

  if (linkedComplexId) {
    const { data: complexRow } = await admin
      .from("complexes")
      .select("name")
      .eq("id", linkedComplexId)
      .maybeSingle();

    const bedroomSummary =
      parsed?.bedroom_rents?.filter((r) => r.bedrooms != null).length ?? 0;

    await admin.rpc("log_building_event", {
      p_complex_id: linkedComplexId,
      p_event_type: "rent_report",
      p_title: `${(complexRow?.name as string) ?? "Building"}: DHCR rent history`,
      p_summary: parsed?.suggested_legal_rent
        ? bedroomSummary > 0
          ? `DHCR extract: ${bedroomSummary} bedroom line(s), ~$${Math.round(parsed.suggested_legal_rent)}/mo mid`
          : `Extracted ~$${Math.round(parsed.suggested_legal_rent)}/mo from DHCR PDF`
        : "DHCR PDF uploaded",
      p_payload: {
        submission_id: submissionId,
        source: "dhcr",
        overcharge_hint: parsed?.overcharge_hint ?? false,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    submissionId,
    status,
    parsed,
    parse_error,
    message:
      status === "parsed"
        ? parsed?.overcharge_hint
          ? "We found a possible overcharge pattern. Review the amounts below. Not legal advice."
          : "Rent amounts extracted from your DHCR PDF. Cross-check against your lease."
        : "Document saved. We could not auto-read text, so our team can review manually.",
  });
}
