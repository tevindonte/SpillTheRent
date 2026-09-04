"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Complex } from "@/lib/complexes";
import {
  fetchBuildingDetail,
  fetchBuildingReviews,
  type BuildingDetail,
  type PanelReview,
} from "@/lib/building-detail";
import { hpdOnlineUrl, hpdScoreColor, portfolioScoreColor } from "@/lib/hpd";
import { panelMapEmbedUrl } from "@/lib/streetview";
import { useAuth } from "@/hooks/useAuth";
import { BuildingRecordSection } from "./panel/BuildingRecordSection";
import { ReviewCard } from "./panel/ReviewCard";
import { BuildingPanelActions } from "./BuildingPanelActions";
import { ShouldISignSummary } from "./panel/ShouldISignSummary";
import { RapSheetShareRow } from "./panel/RapSheetShareRow";
import { RentRealityBlock } from "./panel/RentRealityBlock";
import { DataProvenance } from "./panel/DataProvenance";
import { MicroRatingBlock } from "./panel/MicroRatingBlock";
import { useToast } from "@/hooks/useToast";

type SortOption =
  | "most_recent"
  | "most_helpful"
  | "lowest_rated"
  | "highest_rated";

type BuildingPanelProps = {
  complex: Complex;
  refreshKey?: number;
  onClose: () => void;
  onRateBuilding: (complex: Complex) => void;
  onReportRent: (complex: Complex) => void;
  onCompareChange?: () => void;
};

function ScoreStars({
  rating,
  label,
  count,
  emptyLabel,
  onClick,
  active,
  title,
}: {
  rating: number | null;
  label: string;
  count?: number;
  emptyLabel: string;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={`flex-1 rounded-xl border bg-neutral-900/50 p-3 text-center ${
        active
          ? "border-orange-500/60 ring-1 ring-orange-500/30"
          : "border-neutral-800"
      } ${onClick ? "cursor-pointer transition hover:border-orange-500/40 hover:bg-neutral-900/80" : ""}`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      {rating != null ? (
        <>
          <div className="mt-1 flex justify-center gap-0.5 text-sm">
            {[1, 2, 3, 4, 5].map((s) => (
              <span
                key={s}
                className={
                  s <= Math.round(rating) ? "text-orange-500" : "text-neutral-600"
                }
              >
                ★
              </span>
            ))}
          </div>
          <p className="mt-0.5 text-lg font-semibold text-neutral-100">
            {rating.toFixed(1)}
          </p>
          {count != null && (
            <p className="text-[10px] text-neutral-500">
              ({count} reviews{onClick ? " · tap to read" : ""})
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">{emptyLabel}</p>
      )}
    </Wrapper>
  );
}

export function BuildingPanel({
  complex,
  refreshKey = 0,
  onClose,
  onRateBuilding,
  onReportRent,
  onCompareChange,
}: BuildingPanelProps) {
  const { user } = useAuth();
  const { showToast, Toast } = useToast();
  const [detail, setDetail] = useState<BuildingDetail | null>(null);
  const [reviews, setReviews] = useState<PanelReview[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOption>("most_recent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stabExpanded, setStabExpanded] = useState(false);
  const [nameFormOpen, setNameFormOpen] = useState(false);
  const [suggestedName, setSuggestedName] = useState("");
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [googleOpen, setGoogleOpen] = useState(false);
  const [googleReviews, setGoogleReviews] = useState<PanelReview[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    const data = await fetchBuildingDetail(complex.id);
    setDetail(data);
  }, [complex.id]);

  const loadReviews = useCallback(
    async (pageNum: number, append: boolean) => {
      const data = await fetchBuildingReviews(complex.id, {
        sort,
        page: pageNum,
        limit: 5,
      });
      setReviews((prev) => (append ? [...prev, ...data.reviews] : data.reviews));
      setReviewTotal(data.total);
      setHasMore(data.has_more);
      setPage(pageNum);
    },
    [complex.id, sort]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadDetail();
      await loadReviews(1, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [loadDetail, loadReviews]);

  useEffect(() => {
    void refresh();
  }, [complex.id, refreshKey, refresh]);

  useEffect(() => {
    if (!loading) void loadReviews(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const mapEmbedSrc = panelMapEmbedUrl(
    detail?.street_view_url ?? complex.street_view_url,
    complex.lat,
    complex.lng
  );

  const hpdScore = detail?.hpd_violation_score;
  const hpdOpen = detail?.hpd_open_violations ?? 0;
  const noReviews = detail != null && detail.community_review_count === 0;

  const loadGoogleReviews = useCallback(async () => {
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const data = await fetchBuildingReviews(complex.id, {
        source: "google",
        sort: "most_recent",
        page: 1,
        limit: 20,
      });
      setGoogleReviews(data.reviews);
    } catch (e) {
      setGoogleError(e instanceof Error ? e.message : "Failed to load Google reviews");
    } finally {
      setGoogleLoading(false);
    }
  }, [complex.id]);

  function toggleGoogleReviews() {
    const next = !googleOpen;
    setGoogleOpen(next);
    if (next && googleReviews.length === 0) {
      void loadGoogleReviews();
    }
  }

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/name-suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        complexId: complex.id,
        suggestedName: suggestedName.trim(),
      }),
    });
    const data = await res.json();
    setNameMessage(res.ok ? data.message : data.error);
    if (res.ok) setNameFormOpen(false);
  }

  return (
    <aside
      className="pointer-events-auto flex h-full w-full flex-col border-neutral-800 bg-neutral-950/98 shadow-2xl backdrop-blur-md animate-slide-in-panel md:w-[420px] md:border-l"
      role="dialog"
      aria-label={`Building details for ${complex.name}`}
    >
      <div className="relative h-[200px] w-full shrink-0 overflow-hidden bg-neutral-900">
        {mapEmbedSrc ? (
          <iframe
            title={`Map of ${complex.name}`}
            src={mapEmbedSrc}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-600">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-xs">No map location</span>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-neutral-950/80 px-2.5 py-1 text-xs text-neutral-300 backdrop-blur hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <h2 className="text-xl font-semibold leading-snug text-neutral-50">
          {complex.name}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          {complex.address}
          {complex.zip ? ` · ${complex.zip}` : ""}
        </p>

        <BuildingPanelActions
          complex={complex}
          onToast={showToast}
          onCompareChange={onCompareChange}
        />

        {detail && !loading && <ShouldISignSummary detail={detail} />}

        {detail && !loading && (
          <RapSheetShareRow detail={detail} onToast={showToast} />
        )}

        <MicroRatingBlock complexId={complex.id} onToast={showToast} />

        {detail?.verified === false && (
          <p className="mt-2 text-[10px] text-amber-600/90">
            Unverified building — data from community import; confirm address on
            site.
          </p>
        )}

        {detail?.is_rent_stabilized && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setStabExpanded(!stabExpanded)}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950/50 px-2.5 py-0.5 text-xs text-emerald-400"
            >
              🏛️ Rent Stabilized Building
            </button>
            {stabExpanded && (
              <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 text-xs text-neutral-400">
                {detail.stabilized_units != null && (
                  <p>
                    This building has {detail.stabilized_units.toLocaleString()} rent
                    stabilized units. Tenants in stabilized units have legal protections on
                    rent increases.
                  </p>
                )}
                <a
                  href="https://www.nyc.gov/site/hpd/renters/rent-stabilization.page"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-orange-500 hover:underline"
                >
                  Know your rights →
                </a>
              </div>
            )}
          </div>
        )}

        {detail?.google_place_id == null && (
          <div className="mt-2">
            {!nameFormOpen ? (
              <button
                type="button"
                onClick={() => setNameFormOpen(true)}
                className="text-xs text-orange-500 hover:underline"
              >
                Know this building&apos;s name?
              </button>
            ) : (
              <form onSubmit={submitName} className="mt-2 flex gap-2">
                <input
                  value={suggestedName}
                  onChange={(e) => setSuggestedName(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
                  placeholder="Building name"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-neutral-950"
                >
                  Submit
                </button>
              </form>
            )}
            {nameMessage && (
              <p className="mt-1 text-xs text-emerald-400">{nameMessage}</p>
            )}
          </div>
        )}

        {loading && <p className="mt-6 text-sm text-neutral-500">Loading…</p>}
        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}

        {detail && !loading && (
          <>
            <div className="mt-4 flex gap-2">
              <ScoreStars
                label="spillthe.rent Score"
                rating={detail.spill_score}
                count={detail.community_review_count}
                emptyLabel="No score yet"
                title="Our score combines tenant reviews with official NYC government violation records"
              />
              <ScoreStars
                label="Google Rating"
                rating={detail.google_rating}
                count={detail.google_review_count ?? undefined}
                emptyLabel="Not listed"
                onClick={
                  detail.google_rating != null ? toggleGoogleReviews : undefined
                }
                active={googleOpen}
              />
              <div className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                  HPD Violations
                </p>
                {hpdScore ? (
                  <>
                    <span
                      className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${hpdScoreColor(hpdScore)}`}
                    >
                      {hpdScore}
                    </span>
                    <p className="mt-1 text-[10px] text-neutral-500">
                      {hpdOpen} open violation{hpdOpen === 1 ? "" : "s"}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-xs text-neutral-500">No data</p>
                )}
              </div>
            </div>

            {googleOpen && (
              <div className="mt-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Google reviews
                  </h4>
                  <button
                    type="button"
                    onClick={() => setGoogleOpen(false)}
                    className="text-xs text-neutral-500 hover:text-neutral-300"
                  >
                    Close
                  </button>
                </div>
                {googleLoading && (
                  <p className="text-sm text-neutral-500">Loading Google reviews…</p>
                )}
                {googleError && (
                  <p className="text-sm text-red-400">{googleError}</p>
                )}
                {!googleLoading && !googleError && googleReviews.length === 0 && (
                  <p className="text-sm text-neutral-500">
                    No Google review text stored for this building yet.
                  </p>
                )}
                <ul className="space-y-3">
                  {googleReviews.map((r) => (
                    <li key={r.id}>
                      <ReviewCard review={r} currentUserId={user?.id ?? null} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hpdScore === "Severe" && (
              <p className="mt-2 text-xs text-red-400">
                ⚠️ This building has serious open violations on record
              </p>
            )}

            {hpdScore && (
              <a
                href={hpdOnlineUrl(detail.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-orange-500 hover:underline"
              >
                View on NYC HPD →
              </a>
            )}

            {detail.signals && (
              <BuildingRecordSection
                signals={detail.signals}
                hpdOpenViolations={hpdOpen}
              />
            )}

            {detail.landlord && (
              <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
                <p className="text-sm text-neutral-400">
                  Owned by:{" "}
                  <Link
                    href={`/landlord/${detail.landlord.id}`}
                    className="font-medium text-orange-400 hover:underline"
                  >
                    {detail.landlord.name}
                  </Link>
                </p>
                {detail.landlord.portfolio_score && (
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-xs ${portfolioScoreColor(detail.landlord.portfolio_score)}`}
                  >
                    {detail.landlord.portfolio_score} portfolio
                  </span>
                )}
                <p className="mt-1 text-xs text-neutral-500">
                  {detail.landlord.building_count} buildings in portfolio
                </p>
                <Link
                  href={`/landlord/${detail.landlord.id}`}
                  className="mt-2 inline-block text-xs text-orange-500 hover:underline"
                >
                  View full portfolio →
                </Link>
              </div>
            )}

            <RentRealityBlock
              detail={detail}
              onReportRent={() => onReportRent(complex)}
            />
            {detail.median_rent != null && (
              <Link
                href={`/calculator?rent=${detail.median_rent}&from=building&reports=${detail.rent_report_count}`}
                className="mt-1 inline-block text-xs text-orange-500 hover:underline"
              >
                Run the numbers on this offer →
              </Link>
            )}
            <DataProvenance />

            {detail.red_flags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {detail.red_flags.map((flag) => (
                  <span
                    key={flag}
                    className="rounded-full border border-orange-900/50 bg-orange-950/40 px-2.5 py-0.5 text-xs text-orange-300"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-200">
                  Reviews ({reviewTotal})
                </h3>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300"
                >
                  <option value="most_recent">Most Recent</option>
                  <option value="most_helpful">Most Helpful</option>
                  <option value="lowest_rated">Lowest Rated</option>
                  <option value="highest_rated">Highest Rated</option>
                </select>
              </div>

              {noReviews && (
                <div className="mb-4 rounded-xl border border-dashed border-neutral-700 p-6 text-center">
                  <p className="text-sm font-medium text-neutral-300">
                    No one has spilled the tea on this building yet. 🍵
                  </p>
                  <p className="mt-2 text-xs text-neutral-500">
                    Lived here? Be the first to drop a review and protect the next
                    tenant from signing a bad lease.
                  </p>
                  <button
                    type="button"
                    onClick={() => onRateBuilding(complex)}
                    className="mt-4 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-neutral-950"
                  >
                    ⭐ Drop the first review
                  </button>
                </div>
              )}

              <ul className="space-y-3">
                {reviews.map((r) => (
                  <li key={r.id}>
                    <ReviewCard review={r} currentUserId={user?.id ?? null} />
                  </li>
                ))}
              </ul>

              {hasMore && (
                <button
                  type="button"
                  onClick={() => void loadReviews(page + 1, true)}
                  className="mt-4 w-full rounded-lg border border-neutral-700 py-2 text-sm text-neutral-300 hover:border-orange-500/50"
                >
                  Load {Math.min(5, reviewTotal - reviews.length)} more reviews
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-800 bg-neutral-950/98 p-4 pb-6 md:pb-4">
        <button
          type="button"
          onClick={() => onRateBuilding(complex)}
          className="w-full rounded-full bg-orange-500 py-3 text-sm font-semibold text-neutral-950 hover:bg-orange-400"
        >
          ⭐ Rate This Building
        </button>
      </div>
      {Toast}
    </aside>
  );
}
