export type HpdViolationScore = "Clean" | "Minor" | "Moderate" | "Severe";

export function hpdScoreColor(score: string | null): string {
  switch (score) {
    case "Clean":
      return "bg-emerald-950/60 text-emerald-400 border-emerald-800";
    case "Minor":
      return "bg-yellow-950/60 text-yellow-400 border-yellow-800";
    case "Moderate":
      return "bg-orange-950/60 text-orange-400 border-orange-800";
    case "Severe":
      return "bg-red-950/60 text-red-400 border-red-800";
    default:
      return "bg-neutral-900 text-neutral-500 border-neutral-800";
  }
}

export function hpdOnlineUrl(address: string | null): string {
  const base = "https://hpdonline.nyc.gov/hpdonline/building/search";
  if (!address?.trim()) return base;
  return `${base}?address=${encodeURIComponent(address.trim())}`;
}

export function portfolioScoreColor(score: string | null): string {
  switch (score) {
    case "Excellent":
      return "bg-emerald-950/60 text-emerald-400 border-emerald-800";
    case "Good":
      return "bg-blue-950/60 text-blue-400 border-blue-800";
    case "Fair":
      return "bg-yellow-950/60 text-yellow-400 border-yellow-800";
    case "Poor":
      return "bg-red-950/60 text-red-400 border-red-800";
    default:
      return "bg-neutral-900 text-neutral-500 border-neutral-800";
  }
}
