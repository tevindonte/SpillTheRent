import type { Metadata } from "next";
import MapPage from "@/components/map/MapPage";
import { HomeJsonLd } from "@/components/seo/HomeJsonLd";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE } from "@/lib/seo";

export const metadata: Metadata = {
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <>
      <HomeJsonLd />
      <h1 className="sr-only">{DEFAULT_TITLE}</h1>
      <main className="h-[calc(100vh-3rem)] pt-12">
        <MapPage />
      </main>
    </>
  );
}
