import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteOrigin } from "@/lib/seo";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("complexes")
    .select("name, address, borough, cached_community_score, hpd_violation_score")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) {
    return { title: "Building not found · spillthe.rent" };
  }

  const score =
    data.cached_community_score != null
      ? `${Number(data.cached_community_score).toFixed(1)}/5`
      : "—";
  const title = `${data.name} · NYC Building Reviews & Violations`;
  const description = `${data.address ?? data.name} in ${data.borough ?? "NYC"}. spillthe.rent score ${score}. HPD: ${data.hpd_violation_score ?? "see map"}. Violations, bedbugs, tenant reviews.`;

  const ogImage = `${getSiteOrigin()}/api/og/building/${params.id}`;

  return {
    title,
    description,
    alternates: { canonical: `/building/${params.id}` },
    openGraph: {
      title,
      description,
      url: `${getSiteOrigin()}/building/${params.id}`,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function BuildingPage({ params }: Props) {
  redirect(`/?building=${params.id}`);
}
