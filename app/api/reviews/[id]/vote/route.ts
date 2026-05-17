import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const reviewId = params.id;
  let body: { vote?: string; anonymousToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const vote = body.vote;
  if (vote !== "up" && vote !== "down") {
    return NextResponse.json({ error: "vote must be 'up' or 'down'" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { user } = await getSessionUser();

  const { data: review } = await supabase
    .from("reviews")
    .select("user_id")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  if (user?.id && review.user_id === user.id) {
    return NextResponse.json({ error: "Cannot vote on your own review" }, { status: 403 });
  }

  const token = body.anonymousToken?.trim() || null;

  if (!user && !token) {
    return NextResponse.json({ error: "anonymousToken required" }, { status: 400 });
  }

  // Remove existing vote for this voter
  if (user?.id) {
    await supabase
      .from("review_votes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", user.id);
  } else if (token) {
    await supabase
      .from("review_votes")
      .delete()
      .eq("review_id", reviewId)
      .eq("anonymous_token", token);
  }

  const insertRow: Record<string, unknown> = {
    review_id: reviewId,
    vote,
  };
  if (user?.id) {
    insertRow.user_id = user.id;
  } else {
    insertRow.anonymous_token = token;
  }

  const { error } = await supabase.from("review_votes").insert(insertRow);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: votes } = await supabase
    .from("review_votes")
    .select("vote")
    .eq("review_id", reviewId);

  const up = (votes ?? []).filter((v) => v.vote === "up").length;
  const down = (votes ?? []).filter((v) => v.vote === "down").length;

  return NextResponse.json({ votes_up: up, votes_down: down, user_vote: vote });
}
