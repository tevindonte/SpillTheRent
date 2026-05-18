import { NextRequest, NextResponse } from "next/server";
import { sendContactEmail } from "@/lib/email/contact";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, email, message, website } = body as Record<string, unknown>;

  if (typeof website === "string" && website.trim()) {
    return NextResponse.json({ ok: true });
  }

  if (typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim().length < 10) {
    return NextResponse.json(
      { error: "Message must be at least 10 characters." },
      { status: 400 }
    );
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  }

  try {
    await sendContactEmail({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to send message";
    console.error("[contact]", msg);
    return NextResponse.json(
      { error: "Could not send your message. Try again later or DM us on Instagram." },
      { status: 503 }
    );
  }
}
