import type { QuickRatingStats } from "@/lib/quick-ratings";

export type BuildingSignals = {
  has_bedbug_history: boolean;
  bedbug_last_reported_year: number | null;
  bedbug_report_count: number;
  has_active_construction: boolean;
  active_permit_count: number;
  oath_violation_count: number;
  hp_action_count: number;
  hp_action_last_year: number | null;
};

export type LandlordSummary = {
  id: string;
  name: string;
  portfolio_score: string | null;
  building_count: number;
  total_units: number;
  avg_google_rating: number | null;
  avg_hpd_violations: number | null;
};

export type BuildingDetail = {
  id: string;
  name: string;
  address: string | null;
  borough: string | null;
  neighborhood: string | null;
  zip: string | null;
  verified?: boolean;
  data_source?: string | null;
  units: number | null;
  google_rating: number | null;
  google_review_count: number | null;
  street_view_url: string | null;
  google_place_id: string | null;
  lat: number;
  lng: number;
  median_rent: number | null;
  rent_report_count: number;
  rent_by_bedroom: Record<string, number | null>;
  community_rating: number | null;
  community_review_count: number;
  spill_score: number | null;
  quick_ratings?: QuickRatingStats | null;
  rent_by_year?: { year: number; median_rent: number; report_count: number }[];
  hpd_open_violations: number;
  hpd_violation_score: string | null;
  is_rent_stabilized: boolean;
  stabilized_units: number | null;
  stabilization_year: number | null;
  red_flags: string[];
  landlord: LandlordSummary | null;
  signals: BuildingSignals;
};

export type PanelReview = {
  id: string;
  source?: "user" | "google" | "apartments_com" | "reddit";
  rating: number | null;
  review_text: string | null;
  review_date: string | null;
  red_flags: string[];
  rent_amount: number | null;
  bedrooms: string | null;
  is_anonymous: boolean;
  author_handle: string | null;
  user_id: string | null;
  votes_up: number;
  votes_down: number;
  helpful_score: number;
  user_vote: string | null;
  comment_count: number;
};

export async function fetchBuildingDetail(id: string): Promise<BuildingDetail> {
  const res = await fetch(`/api/complexes/${id}/detail`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load building");
  }
  return res.json();
}

export async function fetchBuildingReviews(
  id: string,
  options: {
    sort?: string;
    page?: number;
    limit?: number;
    source?: "user" | "google";
  } = {}
): Promise<{
  reviews: PanelReview[];
  total: number;
  has_more: boolean;
}> {
  const params = new URLSearchParams();
  if (options.sort) params.set("sort", options.sort);
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.source) params.set("source", options.source);
  const res = await fetch(`/api/complexes/${id}/reviews?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to load reviews");
  }
  return res.json();
}
