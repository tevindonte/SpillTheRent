"use client";

import type { ReactElement } from "react";

export type AppTab = "map" | "feed" | "profile";

type BottomTabBarProps = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
};

const TABS: { id: AppTab; label: string; icon: (active: boolean) => ReactElement }[] = [
  {
    id: "map",
    label: "Map",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 ${active ? "text-neutral-100" : "text-neutral-500"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 20l-5.447-2.724A2 2 0 013 15.382V6.618a2 2 0 011.553-1.946L12 2l7.447 2.672A2 2 0 0121 6.618v8.764a2 2 0 01-1.553 1.946L15 20l-3-1.5-3 1.5z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v17.5" />
      </svg>
    ),
  },
  {
    id: "feed",
    label: "Activity",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 ${active ? "text-neutral-100" : "text-neutral-500"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 6h16M4 10h16M4 14h10M4 18h6"
        />
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Profile",
    icon: (active) => (
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 ${active ? "text-neutral-100" : "text-neutral-500"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 21a8 8 0 10-16 0M12 13a4 4 0 100-8 4 4 0 000 8z"
        />
      </svg>
    ),
  },
];

export function BottomTabBar({ active, onChange }: BottomTabBarProps) {
  return (
    <nav
      className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[1100] border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-md"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-14 max-w-lg">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition ${
                isActive ? "text-neutral-100" : "text-neutral-500 hover:text-neutral-300"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.icon(isActive)}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
