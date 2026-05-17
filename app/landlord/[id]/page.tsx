import { LandlordClient } from "@/components/landlord/LandlordClient";

export default function LandlordPage({
  params,
}: {
  params: { id: string };
}) {
  return <LandlordClient id={params.id} />;
}
