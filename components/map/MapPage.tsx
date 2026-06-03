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
      <div className="relative h-full">
        <MapView />
        <footer className="pointer-events-none absolute bottom-0 left-0 right-0 z-[500] flex justify-center pb-2">
          <nav className="pointer-events-auto flex gap-4 text-[10px] text-neutral-600">
            <a href="/faq" className="hover:text-orange-400">
              FAQ
            </a>
            <a href="/about" className="hover:text-orange-400">
              About
            </a>
            <a href="/leaderboard" className="hover:text-orange-400">
              Leaderboard
            </a>
            <a href="/feed" className="hover:text-orange-400">
              Activity
            </a>
          </nav>
        </footer>
      </div>
    </Suspense>
  );
}
