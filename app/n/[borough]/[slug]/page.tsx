import type { Metadata } from "next";
import Link from "next/link";
import {
  boroughLabel,
  type BoroughSlug,
  BOROUGH_SLUGS,
} from "@/lib/neighborhoods";
import { loadNeighborhoodIntel } from "@/lib/neighborhood-intel";
import { getSiteOrigin } from "@/lib/seo";
import { RentTrendBars } from "@/components/neighborhood/RentTrendBars";
import { formatRent } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relative-time";

type Props = { params: { borough: string; slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!BOROUGH_SLUGS.includes(params.borough as BoroughSlug)) {
    return { title: "Neighborhood · spillthe.rent" };
  }
  const hood = await loadNeighborhoodIntel(
    params.borough as BoroughSlug,
    params.slug
  );
  if (!hood) return { title: "Neighborhood · spillthe.rent" };

  const borough = boroughLabel(params.borough as BoroughSlug);
  const title = `${hood.name}, ${borough} · Apartment Reviews & Violations`;
  const description = `${hood.building_count} buildings · ${hood.total_reviews} reviews · avg ${hood.avg_hpd_open} open HPD violations. Median rent ${hood.median_rent != null ? formatRent(hood.median_rent) : "-"}/mo. Research before you lease.`;

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

  const hood = await loadNeighborhoodIntel(
    params.borough as BoroughSlug,
    params.slug
  );
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
        {hood.building_count} buildings · {hood.total_reviews} tenant reviews on
        spillthe.rent. Research HPD violations, bedbugs, and real rent before you
        lease.
      </p>

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">
            Median rent
          </p>
          <p className="mt-1 text-lg font-semibold text-neutral-100">
            {hood.median_rent != null ? `${formatRent(hood.median_rent)}/mo` : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">
            Avg open HPD
          </p>
          <p className="mt-1 text-lg font-semibold text-neutral-100">
            {hood.avg_hpd_open}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">
            Buildings mapped
          </p>
          <p className="mt-1 text-lg font-semibold text-neutral-100">
            {hood.building_count}
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Rent trend (last 12 months)
        </h2>
        <RentTrendBars points={hood.rent_trends} />
      </section>

      {hood.top_red_flags.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Common review themes
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {hood.top_red_flags.map(({ flag, count }) => (
              <li
                key={flag}
                className="rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1 text-xs text-neutral-300"
              >
                {flag.replace(/_/g, " ")} ({count})
              </li>
            ))}
          </ul>
        </section>
      )}

      {hood.worst_landlords.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Landlords with most HPD exposure here
          </h2>
          <ul className="mt-3 space-y-2">
            {hood.worst_landlords.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/landlord/${l.id}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 hover:border-orange-500/40"
                >
                  <span className="font-medium text-neutral-100">{l.name}</span>
                  <span className="text-xs text-neutral-500">
                    {l.building_count} bldgs · {l.total_hpd} open HPD
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hood.recent_events.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Recent activity
          </h2>
          <ul className="mt-3 space-y-2">
            {hood.recent_events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/?building=${e.complex_id}`}
                  className="block rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 hover:border-orange-500/30"
                >
                  <p className="text-sm text-neutral-200">{e.title}</p>
                  <p className="text-[10px] text-neutral-600">
                    {formatRelativeTime(e.created_at)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/feed"
            className="mt-3 inline-block text-xs text-orange-400 hover:underline"
          >
            City-wide activity feed →
          </Link>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Buildings
        </h2>
        <ul className="mt-3 space-y-2">
          {hood.buildings.map((b) => (
            <li key={b.id}>
              <Link
                href={`/?building=${b.id}`}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 hover:border-orange-500/40"
              >
                <span className="font-medium text-neutral-100">{b.name}</span>
                <span className="text-xs text-neutral-500">
                  {b.cached_community_score != null &&
                    `${Number(b.cached_community_score).toFixed(1)}/5 · `}
                  HPD {b.hpd_open_violations ?? 0}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-neutral-950"
      >
        Open map
      </Link>
    </div>
  );
}
