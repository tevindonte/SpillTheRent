import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  boroughDbMatch,
  boroughLabel,
  type BoroughSlug,
  BOROUGH_SLUGS,
} from "@/lib/neighborhoods";
import { getSiteOrigin } from "@/lib/seo";

type Props = { params: { borough: string; slug: string } };

async function loadNeighborhood(borough: BoroughSlug, slug: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("complexes")
    .select("id, name, neighborhood, cached_community_score, cached_review_count")
    .in("borough", boroughDbMatch(borough));

  const normalizedSlug = slug.toLowerCase();
  const matched = (data ?? []).filter((c) => {
    const hood = (c.neighborhood ?? "").toLowerCase().replace(/\s+/g, "-");
    return hood === normalizedSlug || hood.includes(normalizedSlug);
  });

  if (!matched.length) return null;

  const name =
    matched[0].neighborhood ??
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    name,
    building_count: matched.length,
    total_reviews: matched.reduce((s, c) => s + (c.cached_review_count ?? 0), 0),
    buildings: matched.slice(0, 24),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!BOROUGH_SLUGS.includes(params.borough as BoroughSlug)) {
    return { title: "Neighborhood · spillthe.rent" };
  }
  const hood = await loadNeighborhood(params.borough as BoroughSlug, params.slug);
  if (!hood) return { title: "Neighborhood · spillthe.rent" };

  const borough = boroughLabel(params.borough as BoroughSlug);
  const title = `${hood.name}, ${borough} — Apartment Reviews & Violations`;
  const description = `Research ${hood.building_count}+ buildings in ${hood.name}, ${borough}. ${hood.total_reviews} tenant reviews, HPD violations, bedbug history, and spillthe.rent scores.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/n/${params.borough}/${params.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${getSiteOrigin()}/n/${params.borough}/${params.slug}`,
    },
  };
}

export default async function NeighborhoodPage({ params }: Props) {
  if (!BOROUGH_SLUGS.includes(params.borough as BoroughSlug)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-neutral-400">
        Unknown borough.
      </div>
    );
  }

  const hood = await loadNeighborhood(params.borough as BoroughSlug, params.slug);
  if (!hood) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-neutral-400">
        No buildings found for this neighborhood yet.
      </div>
    );
  }

  const borough = boroughLabel(params.borough as BoroughSlug);

  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-2xl px-4 py-12">
      <Link href="/" className="text-xs text-neutral-500 hover:text-orange-400">
        ← Map
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-neutral-50">
        {hood.name}, {borough}
      </h1>
      <p className="mt-2 text-sm text-neutral-400">
        {hood.building_count} buildings · {hood.total_reviews} reviews on
        spillthe.rent. See HPD violations, bedbugs, and tenant-reported rent before
        you lease.
      </p>
      <ul className="mt-8 space-y-2">
        {hood.buildings.map((b) => (
          <li key={b.id}>
            <Link
              href={`/?building=${b.id}`}
              className="block rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 hover:border-orange-500/40"
            >
              <span className="font-medium text-neutral-100">{b.name}</span>
              {b.cached_community_score != null && (
                <span className="ml-2 text-xs text-orange-400">
                  {Number(b.cached_community_score).toFixed(1)}/5
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-neutral-950"
      >
        Open map
      </Link>
    </div>
  );
}
