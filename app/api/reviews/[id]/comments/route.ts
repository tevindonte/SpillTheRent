import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const reviewId = params.id;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("review_comments")
    .select(
      `
      id, parent_id, content, is_anonymous, created_at, user_id,
      profiles:user_id ( handle )
    `
    )
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const comments = (data ?? []).map((row) => {
    const profile = row.profiles as { handle?: string } | { handle?: string }[] | null;
    const handle = Array.isArray(profile)
      ? profile[0]?.handle
      : profile?.handle;
    return {
      id: row.id,
      parent_id: row.parent_id,
      content: row.content,
      is_anonymous: row.is_anonymous,
      created_at: row.created_at,
      author_handle: handle ?? null,
    };
  });

  return NextResponse.json({ comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const reviewId = params.id;
  let body: { content?: string; parent_id?: string | null; is_anonymous?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = body.content?.trim() ?? "";
  if (content.length < 10) {
    return NextResponse.json(
      { error: "Comment must be at least 10 characters" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { user } = await getSessionUser();

  let userId: string | null = null;
  if (user) {
    const profile = await ensureProfile(supabase, user.id, user.email);
    userId = profile.id;
  }

  if (body.parent_id) {
    const { data: parent } = await supabase
      .from("review_comments")
      .select("id, parent_id, review_id")
      .eq("id", body.parent_id)
      .maybeSingle();

    if (!parent || parent.review_id !== reviewId) {
      return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
    }
    if (parent.parent_id) {
      return NextResponse.json(
        { error: "Cannot reply to a reply (max 2 levels)" },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("review_comments")
    .insert({
      review_id: reviewId,
      parent_id: body.parent_id ?? null,
      user_id: userId,
      is_anonymous: body.is_anonymous ?? !user,
      content,
    })
    .select("id, parent_id, content, is_anonymous, created_at, user_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let author_handle: string | null = null;
  if (userId && !data.is_anonymous) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", userId)
      .maybeSingle();
    author_handle = profile?.handle ?? null;
  }

  return NextResponse.json({
    comment: {
      ...data,
      author_handle,
    },
  });
}
