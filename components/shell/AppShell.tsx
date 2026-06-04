"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  OnboardingSlides,
  hasCompletedOnboarding,
} from "@/components/onboarding/OnboardingSlides";
import { ActivityFeed } from "@/components/feed/ActivityFeed";
import { ProfileView } from "@/components/profile/ProfileView";
import { BottomTabBar, type AppTab } from "./BottomTabBar";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-neutral-950 text-sm text-neutral-500">
      Loading map…
    </div>
  ),
});

export default function AppShell() {
  const [tab, setTab] = useState<AppTab>("map");
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    setShowOnboarding(!hasCompletedOnboarding());
    setOnboardingChecked(true);
  }, []);

  if (!onboardingChecked) {
    return <div className="h-screen w-screen bg-neutral-950" />;
  }

  if (showOnboarding) {
    return (
      <OnboardingSlides
        onComplete={() => {
          setShowOnboarding(false);
          setTab("map");
        }}
      />
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-neutral-950">
      <main className="absolute inset-0 bottom-14 overflow-hidden">
        {tab === "map" && <MapView />}
        {tab === "feed" && <ActivityFeed embedded />}
        {tab === "profile" && (
          <ProfileView onGoToMap={() => setTab("map")} />
        )}
      </main>
      <BottomTabBar active={tab} onChange={setTab} />
    </div>
  );
}
