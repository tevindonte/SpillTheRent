import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { RED_FLAG_OPTIONS } from "@/lib/submissions/constants";

const FLAG_LABELS = Object.fromEntries(
  RED_FLAG_OPTIONS.map((f) => [f.value, f.label])
) as Record<string, string>;

type SortOption = "most_recent" | "most_helpful" | "lowest_rated" | "highest_rated";
type SourceFilter = "user" | "google";

const REVIEW_SELECT = `
  id, rating, review_text, review_date, created_at, source, red_flags, red_flag_other,
  rent_amount, bedrooms, user_id,
  profiles:user_id ( handle )
`;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const complexId = params.id;
  const sort = (request.nextUrl.searchParams.get("sort") ??
    "most_recent") as SortOption;
  const source = (request.nextUrl.searchParams.get("source") ?? "user") as SourceFilter;
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(20, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") ?? "5", 10)));
  const offset = (page - 1) * limit;

  if (source !== "user" && source !== "google") {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { user } = await getSessionUser();

  const { count: totalCount } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("complex_id", complexId)
    .eq("source", source);

  let query = supabase
    .from("reviews")
    .select(REVIEW_SELECT)
    .eq("complex_id", complexId)
    .eq("source", source);

  if (sort === "lowest_rated") {
    query = query.order("rating", { ascending: true, nullsFirst: false });
  } else if (sort === "highest_rated") {
    query = query.order("rating", { ascending: false, nullsFirst: false });
  } else if (source === "google") {
    query = query.order("review_date", { ascending: false, nullsFirst: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data: reviews, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const reviewIds = (reviews ?? []).map((r) => r.id);

  const voteCounts: Record<string, { up: number; down: number }> = {};
  const userVotes: Record<string, string> = {};
  const commentCounts: Record<string, number> = {};

  if (source === "user" && reviewIds.length > 0) {
    const { data: votes, error: votesError } = await supabase
      .from("review_votes")
      .select("review_id, vote, user_id")
      .in("review_id", reviewIds);

    if (!votesError) {
      for (const v of votes ?? []) {
        if (!voteCounts[v.review_id]) voteCounts[v.review_id] = { up: 0, down: 0 };
        if (v.vote === "up") voteCounts[v.review_id].up += 1;
        else voteCounts[v.review_id].down += 1;
        if (user?.id && v.user_id === user.id) {
          userVotes[v.review_id] = v.vote;
        }
      }
    }

    const { data: comments, error: commentsError } = await supabase
      .from("review_comments")
      .select("review_id")
      .in("review_id", reviewIds);

    if (!commentsError) {
      for (const c of comments ?? []) {
        commentCounts[c.review_id] = (commentCounts[c.review_id] ?? 0) + 1;
      }
    }
  }

  const mapped = (reviews ?? []).map((row) => {
    const profile = row.profiles as { handle?: string } | { handle?: string }[] | null;
    const handle = Array.isArray(profile)
      ? profile[0]?.handle
      : profile?.handle;
    const flags = (row.red_flags ?? []).map((f: string) => FLAG_LABELS[f] ?? f);
    if (row.red_flag_other) flags.push(row.red_flag_other);

    const helpful =
      (voteCounts[row.id]?.up ?? 0) - (voteCounts[row.id]?.down ?? 0);

    return {
      id: row.id,
      source: row.source as SourceFilter,
      rating: row.rating,
      review_text: row.review_text,
      review_date: row.review_date ?? row.created_at,
      red_flags: flags,
      rent_amount: row.rent_amount,
      bedrooms: row.bedrooms,
      is_anonymous: !row.user_id,
      author_handle: handle ?? null,
      user_id: row.user_id,
      votes_up: voteCounts[row.id]?.up ?? 0,
      votes_down: voteCounts[row.id]?.down ?? 0,
      helpful_score: helpful,
      user_vote: userVotes[row.id] ?? null,
      comment_count: commentCounts[row.id] ?? 0,
    };
  });

  if (sort === "most_helpful" && source === "user") {
    mapped.sort((a, b) => b.helpful_score - a.helpful_score);
  }

  return NextResponse.json({
    reviews: mapped,
    total: totalCount ?? 0,
    page,
    limit,
    has_more: (totalCount ?? 0) > page * limit,
    source,
  });
}
