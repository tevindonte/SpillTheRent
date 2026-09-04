import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("landlords")
    .select("name, portfolio_score, building_count")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) {
    return { title: "Landlord portfolio · spillthe.rent" };
  }

  const title = `${data.name} · Slumlord Score & Portfolio`;
  const description = `NYC landlord ${data.name}: ${data.building_count} buildings, portfolio score ${data.portfolio_score ?? "-"}. Violations and tenant reviews on spillthe.rent.`;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default function LandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
