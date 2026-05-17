"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PanelReview } from "@/lib/building-detail";
import { formatRelativeTime } from "@/lib/relative-time";
import { getAnonymousVoteToken } from "@/lib/vote-token";
import { useAuth } from "@/hooks/useAuth";
import { formatRent } from "@/lib/format";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className={s <= Math.round(rating) ? "text-orange-500" : "text-neutral-600"}
        >
          ★
        </span>
      ))}
    </div>
  );
}

type Comment = {
  id: string;
  parent_id: string | null;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  author_handle: string | null;
};

export function ReviewCard({
  review,
  currentUserId,
}: {
  review: PanelReview;
  currentUserId: string | null;
}) {
  const { user } = useAuth();
  const [votesUp, setVotesUp] = useState(review.votes_up);
  const [votesDown, setVotesDown] = useState(review.votes_down);
  const [userVote, setUserVote] = useState<string | null>(review.user_vote);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isOwn = currentUserId && review.user_id === currentUserId;

  async function vote(direction: "up" | "down") {
    if (isOwn) return;
    const res = await fetch(`/api/reviews/${review.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vote: direction,
        anonymousToken: user ? undefined : getAnonymousVoteToken(),
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setVotesUp(data.votes_up);
    setVotesDown(data.votes_down);
    setUserVote(data.user_vote);
  }

  async function loadComments() {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments ?? []);
      }
    } finally {
      setLoadingComments(false);
    }
  }

  useEffect(() => {
    if (commentsOpen && comments.length === 0) {
      void loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsOpen]);

  async function submitComment(parentId: string | null) {
    const content = commentText.trim();
    if (content.length < 10) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          parent_id: parentId,
          is_anonymous: !user,
        }),
      });
      if (res.ok) {
        setCommentText("");
        setReplyTo(null);
        await loadComments();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesByParent = comments.reduce<Record<string, Comment[]>>((acc, c) => {
    if (c.parent_id) {
      if (!acc[c.parent_id]) acc[c.parent_id] = [];
      acc[c.parent_id].push(c);
    }
    return acc;
  }, {});

  return (
    <article className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <Stars rating={review.rating ?? 0} />
        <span className="text-xs text-neutral-500">
          {formatRelativeTime(review.review_date)}
        </span>
      </div>

      <p className="mb-1 text-xs text-neutral-500">
        {review.is_anonymous
          ? "Anonymous"
          : review.author_handle
            ? `@${review.author_handle}`
            : "Tenant"}
      </p>

      {review.review_text && (
        <p className="text-sm leading-relaxed text-neutral-300">{review.review_text}</p>
      )}

      {review.rent_amount != null && (
        <p className="mt-2 text-xs text-neutral-500">
          Reported rent: {formatRent(review.rent_amount)}/mo
          {review.bedrooms ? ` · ${review.bedrooms}` : ""}
        </p>
      )}

      {review.red_flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {review.red_flags.map((f) => (
            <span
              key={f}
              className="rounded-full bg-orange-950/50 px-2 py-0.5 text-xs text-orange-300"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!!isOwn}
          onClick={() => vote("up")}
          className={`text-xs ${userVote === "up" ? "text-orange-400" : "text-neutral-500"} disabled:opacity-40`}
        >
          👍 {votesUp}
        </button>
        <button
          type="button"
          disabled={!!isOwn}
          onClick={() => vote("down")}
          className={`text-xs ${userVote === "down" ? "text-orange-400" : "text-neutral-500"} disabled:opacity-40`}
        >
          👎 {votesDown}
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen(!commentsOpen)}
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          {review.comment_count} comment{review.comment_count === 1 ? "" : "s"}
        </button>
      </div>

      {commentsOpen && (
        <div className="mt-3 border-t border-neutral-800 pt-3">
          {loadingComments ? (
            <p className="text-xs text-neutral-500">Loading comments…</p>
          ) : (
            <ul className="space-y-3">
              {topLevel.map((c) => (
                <li key={c.id}>
                  <p className="text-xs text-neutral-500">
                    {c.is_anonymous ? "Anonymous" : c.author_handle ? `@${c.author_handle}` : "User"}
                    {" · "}
                    {formatRelativeTime(c.created_at)}
                  </p>
                  <p className="text-sm text-neutral-300">{c.content}</p>
                  <button
                    type="button"
                    onClick={() => setReplyTo(c.id)}
                    className="mt-1 text-xs text-orange-500 hover:underline"
                  >
                    Reply
                  </button>
                  {(repliesByParent[c.id] ?? []).map((r) => (
                    <div key={r.id} className="ml-4 mt-2 border-l border-neutral-800 pl-3">
                      <p className="text-xs text-neutral-500">
                        {r.is_anonymous ? "Anonymous" : r.author_handle ? `@${r.author_handle}` : "User"}
                        {" · "}
                        {formatRelativeTime(r.created_at)}
                      </p>
                      <p className="text-sm text-neutral-300">{r.content}</p>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}

          {!user && (
            <p className="mt-2 text-xs text-neutral-500">
              <Link href="/login" className="text-orange-500 hover:underline">
                Sign in
              </Link>{" "}
              to attach comments to your profile
            </p>
          )}

          <div className="mt-3">
            {replyTo && (
              <p className="mb-1 text-xs text-neutral-500">
                Replying…{" "}
                <button type="button" onClick={() => setReplyTo(null)} className="text-orange-500">
                  cancel
                </button>
              </p>
            )}
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment (min 10 characters)…"
              rows={2}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
            <button
              type="button"
              disabled={submitting || commentText.trim().length < 10}
              onClick={() => submitComment(replyTo)}
              className="mt-2 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 disabled:opacity-50"
            >
              Post comment
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
