"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  OnboardingSlides,
  hasCompletedOnboarding,
} from "@/components/onboarding/OnboardingSlides";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#0a0a0a] text-sm text-neutral-500">
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setShowOnboarding(!hasCompletedOnboarding());
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="h-full bg-[#0a0a0a]" />;
  }

  if (showOnboarding) {
    return (
      <OnboardingSlides onComplete={() => setShowOnboarding(false)} />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-[#0a0a0a] text-sm text-neutral-500">
          Loading map…
        </div>
      }
    >
      <MapView />
    </Suspense>
  );
}
