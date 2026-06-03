import type { BuildingDetail } from "@/lib/building-detail";
import { buildShouldISignSummary } from "@/lib/should-i-sign";
import { getSiteUrl } from "@/lib/auth/site-url";

export function buildingShareUrl(complexId: string): string {
  return `${getSiteUrl()}/?building=${complexId}`;
}

export function buildingOgImageUrl(complexId: string): string {
  return `${getSiteUrl()}/api/og/building/${complexId}`;
}

export function rapSheetShareText(detail: BuildingDetail): string {
  const summary = buildShouldISignSummary(detail);
  const hpd = detail.hpd_open_violations;
  const parts = [
    `${detail.name}`,
    summary.headline,
    hpd > 0 ? `${hpd} open HPD violation${hpd === 1 ? "" : "s"}` : null,
    detail.spill_score != null
      ? `spillthe.rent score ${detail.spill_score.toFixed(1)}/5`
      : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function twitterShareUrl(detail: BuildingDetail): string {
  const text = `${rapSheetShareText(detail)} — full rap sheet:`;
  const url = buildingShareUrl(detail.id);
  const params = new URLSearchParams({
    text,
    url,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function redditShareUrl(detail: BuildingDetail): string {
  const params = new URLSearchParams({
    title: `Building intel: ${detail.name} — spillthe.rent`,
    url: buildingShareUrl(detail.id),
  });
  return `https://www.reddit.com/submit?${params.toString()}`;
}
