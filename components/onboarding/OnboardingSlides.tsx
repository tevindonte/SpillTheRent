"use client";

import { useState } from "react";

const STORAGE_KEY = "spr_onboarded";

const SLIDES = [
  {
    label: "THE TRUTH ABOUT YOUR BUILDING.",
    title: "Don't sign a lease blind.",
    subtitle:
      "Real tenant reviews surface mold, deposit theft, broken elevators, and management nightmares before you move in. Not after.",
    illustration: "reviews",
  },
  {
    label: "ONE BUILDING. EIGHT DIFFERENT PRICES.",
    title: "Everyone here pays something different.",
    subtitle:
      "And until now, nobody knew. See what real tenants actually paid — not what the listing says.",
    illustration: "pricing",
  },
  {
    label: "MANHATTAN. ALL OF IT.",
    title: "12,000+ buildings. Real ratings.",
    subtitle:
      "Search any address. See Google reviews, red flag warnings, and real prices people actually paid. All in one place.",
    illustration: "scale",
  },
] as const;

function ReviewsIllustration() {
  return (
    <svg viewBox="0 0 280 200" className="mx-auto h-48 w-full max-w-[280px]" aria-hidden>
      <rect x="90" y="50" width="100" height="120" rx="6" fill="#171717" stroke="#404040" />
      {[0, 1, 2].map((row) =>
        [0, 1].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={102 + col * 36}
            y={65 + row * 32}
            width="24"
            height="20"
            fill="#262626"
            stroke="#525252"
          />
        ))
      )}
      <ellipse cx="60" cy="75" rx="42" ry="14" fill="#262626" stroke="#f97316" />
      <text x="60" y="79" textAnchor="middle" fill="#fafafa" fontSize="8">
        mold in bathroom
      </text>
      <ellipse cx="220" cy="95" rx="48" ry="14" fill="#262626" stroke="#f97316" />
      <text x="220" y="99" textAnchor="middle" fill="#fafafa" fontSize="8">
        took my deposit
      </text>
      <ellipse cx="200" cy="155" rx="52" ry="14" fill="#262626" stroke="#f97316" />
      <text x="200" y="159" textAnchor="middle" fill="#fafafa" fontSize="7">
        elevator broken 3 months
      </text>
    </svg>
  );
}

function PricingIllustration() {
  return (
    <svg viewBox="0 0 280 200" className="mx-auto h-48 w-full max-w-[280px]" aria-hidden>
      <rect x="100" y="40" width="80" height="130" rx="6" fill="#171717" stroke="#404040" />
      {[
        { y: 55, price: "$2,800" },
        { y: 85, price: "$3,400" },
        { y: 115, price: "$2,650" },
        { y: 145, price: "$3,100" },
      ].map(({ y, price }) => (
        <g key={price}>
          <ellipse cx="175" cy={y} rx="36" ry="11" fill="#f97316" opacity="0.9" />
          <text x="175" y={y + 4} textAnchor="middle" fill="#0a0a0a" fontSize="9" fontWeight="700">
            {price}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ScaleIllustration() {
  return (
    <svg viewBox="0 0 280 200" className="mx-auto h-48 w-full max-w-[280px]" aria-hidden>
      <rect x="30" y="30" width="220" height="140" rx="12" fill="#171717" stroke="#404040" />
      <circle cx="80" cy="80" r="16" fill="#22c55e" opacity="0.85" />
      <circle cx="140" cy="100" r="16" fill="#eab308" opacity="0.85" />
      <circle cx="200" cy="70" r="16" fill="#6b7280" opacity="0.85" />
      <text x="80" y="84" textAnchor="middle" fill="#0a0a0a" fontSize="8" fontWeight="700">
        $2.4k
      </text>
      <text x="140" y="104" textAnchor="middle" fill="#0a0a0a" fontSize="8" fontWeight="700">
        $3.1k
      </text>
      <path d="M50 150 Q140 120 230 140" stroke="#525252" fill="none" strokeWidth="2" />
    </svg>
  );
}

function Illustration({ type }: { type: string }) {
  if (type === "reviews") return <ReviewsIllustration />;
  if (type === "pricing") return <PricingIllustration />;
  return <ScaleIllustration />;
}

type OnboardingSlidesProps = {
  onComplete: () => void;
};

export function OnboardingSlides({ onComplete }: OnboardingSlidesProps) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  function finish() {
    localStorage.setItem(STORAGE_KEY, "true");
    onComplete();
  }

  return (
    <div className="fixed inset-0 z-[3000] flex flex-col bg-[#0a0a0a]">
      <div className="flex items-center px-4 pt-4">
        <button
          type="button"
          onClick={() => (index > 0 ? setIndex((i) => i - 1) : finish())}
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
          aria-label={index > 0 ? "Back" : "Skip"}
        >
          ←
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-8">
        <Illustration type={slide.illustration} />
        <p className="mt-8 text-center text-[10px] font-semibold tracking-[0.2em] text-orange-500">
          {slide.label}
        </p>
        <h1 className="font-serif mt-4 max-w-md text-center text-3xl font-medium leading-tight text-neutral-50 sm:text-4xl">
          {slide.title}
        </h1>
        <p className="mt-4 max-w-sm text-center text-sm leading-relaxed text-neutral-400">
          {slide.subtitle}
        </p>
        <div className="mt-8 flex gap-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-8 bg-orange-500" : "w-2 bg-neutral-700"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="px-6 pb-10">
        {isLast ? (
          <button
            type="button"
            onClick={finish}
            className="w-full rounded-full bg-orange-500 py-4 text-sm font-semibold text-neutral-950 transition hover:bg-orange-400"
          >
            Open the map →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            className="w-full rounded-full bg-orange-500 py-4 text-sm font-semibold text-neutral-950 transition hover:bg-orange-400"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

export function hasCompletedOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) === "true";
}
