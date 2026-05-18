import type { Complex } from "@/lib/complexes";
import { ratingColor } from "@/lib/complexes";
import type { CircleMarker, Marker } from "leaflet";
import L from "leaflet";

type MarkerClusterLike = {
  getChildCount: () => number;
  getAllChildMarkers: () => (CircleMarker | Marker)[];
};

/** Unified map score: spill score → Google → none. */
export function mapScore(complex: Complex): number | null {
  if (complex.cached_community_score != null) {
    return complex.cached_community_score;
  }
  if (complex.google_rating != null) {
    return complex.google_rating;
  }
  return null;
}

export type ComplexLayer = (CircleMarker | Marker) & { __complex?: Complex };

export function attachComplexToLayer(
  layer: CircleMarker | Marker | null,
  complex: Complex
): void {
  if (layer) {
    (layer as ComplexLayer).__complex = complex;
  }
}

/** Average score of clustered buildings (representative color). */
export function clusterRepresentativeScore(
  cluster: MarkerClusterLike
): number | null {
  const markers = cluster.getAllChildMarkers() as ComplexLayer[];
  const scores: number[] = [];
  for (const m of markers) {
    const s = m.__complex ? mapScore(m.__complex) : null;
    if (s != null) scores.push(s);
  }
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function createScoreClusterIcon(cluster: MarkerClusterLike): L.DivIcon {
  const count = cluster.getChildCount();
  const score = clusterRepresentativeScore(cluster);
  const color = ratingColor(score);
  const size = count < 10 ? 36 : count < 100 ? 44 : 52;

  return L.divIcon({
    html: `<div class="spill-cluster-bubble" style="--cluster-color:${color};width:${size}px;height:${size}px"><span>${count}</span></div>`,
    className: "spill-cluster-icon",
    iconSize: L.point(size, size),
    iconAnchor: L.point(size / 2, size / 2),
  });
}
