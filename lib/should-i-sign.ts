import type { BuildingDetail } from "@/lib/building-detail";

export type SignVerdict = "caution" | "mixed" | "ok" | "unknown";

export type ShouldISignSummary = {
  verdict: SignVerdict;
  headline: string;
  bullets: string[];
};

export function buildShouldISignSummary(detail: BuildingDetail): ShouldISignSummary {
  const bullets: string[] = [];
  let riskPoints = 0;

  const hpd = detail.hpd_violation_score;
  const hpdOpen = detail.hpd_open_violations ?? 0;
  if (hpd === "Severe" || hpdOpen > 15) {
    riskPoints += 3;
    bullets.push(
      `${hpdOpen} open HPD violation${hpdOpen === 1 ? "" : "s"} (${hpd ?? "on record"})`
    );
  } else if (hpd === "Moderate" || hpdOpen > 5) {
    riskPoints += 2;
    bullets.push(`${hpdOpen} open HPD violations`);
  } else if (hpdOpen > 0) {
    riskPoints += 1;
    bullets.push(`${hpdOpen} open HPD violation${hpdOpen === 1 ? "" : "s"}`);
  }

  const sig = detail.signals;
  if (sig?.has_bedbug_history) {
    riskPoints += 2;
    const yr = sig.bedbug_last_reported_year;
    bullets.push(
      yr
        ? `Bedbug filings on record (last ${yr})`
        : "Bedbug history on NYC registry"
    );
  }

  if ((sig?.hp_action_count ?? 0) >= 3) {
    riskPoints += 2;
    bullets.push(`${sig!.hp_action_count} HP actions (tenant lawsuits)`);
  } else if ((sig?.hp_action_count ?? 0) > 0) {
    riskPoints += 1;
    bullets.push(`${sig!.hp_action_count} HP action on record`);
  }

  if ((sig?.oath_violation_count ?? 0) > 0) {
    riskPoints += 1;
    bullets.push(`${sig!.oath_violation_count} OATH / illegal-use violations`);
  }

  if (sig?.has_active_construction) {
    riskPoints += 1;
    bullets.push("Active construction permits");
  }

  if (detail.red_flags.length > 0) {
    riskPoints += 1;
    const preview = detail.red_flags.slice(0, 3).join(", ");
    bullets.push(
      `Review themes: ${preview}${detail.red_flags.length > 3 ? "…" : ""}`
    );
  }

  const score = detail.spill_score;
  if (score != null && score < 2.5) {
    riskPoints += 2;
    bullets.push(`Low spillthe.rent score (${score.toFixed(1)}/5)`);
  } else if (score != null && score >= 4) {
    riskPoints -= 1;
  }

  if (detail.is_rent_stabilized) {
    bullets.push("Rent-stabilized building (extra tenant protections)");
  }

  if (detail.community_review_count > 0) {
    bullets.push(
      `${detail.community_review_count} tenant review${detail.community_review_count === 1 ? "" : "s"} on spillthe.rent`
    );
  }

  if (detail.median_rent != null) {
    bullets.push(
      `Reported median rent ~$${detail.median_rent.toLocaleString()}/mo (tenant + listing data)`
    );
  }

  let verdict: SignVerdict = "unknown";
  let headline: string;

  if (riskPoints >= 5) {
    verdict = "caution";
    headline = "Proceed with caution: serious red flags on record";
  } else if (riskPoints >= 2) {
    verdict = "mixed";
    headline = "Mixed signals. Read violations and reviews before signing";
  } else if (riskPoints === 0 && (score == null || score >= 3.5)) {
    verdict = "ok";
    headline = "Fewer official red flags, but still visit and verify in person";
  } else if (riskPoints === 0) {
    verdict = "unknown";
    headline = "Limited data. Verify condition and lease terms yourself";
  } else {
    verdict = "mixed";
    headline = "Some concerns on record, so do extra due diligence";
  }

  if (bullets.length === 0) {
    bullets.push("No major violations or review themes flagged yet");
    bullets.push("Ask current tenants and check the unit in person");
  }

  return { verdict, headline, bullets: bullets.slice(0, 6) };
}

export function verdictStyles(verdict: SignVerdict): {
  border: string;
  bg: string;
  text: string;
} {
  switch (verdict) {
    case "caution":
      return {
        border: "border-red-800/60",
        bg: "bg-red-950/40",
        text: "text-red-300",
      };
    case "mixed":
      return {
        border: "border-amber-800/60",
        bg: "bg-amber-950/30",
        text: "text-amber-200",
      };
    case "ok":
      return {
        border: "border-emerald-800/60",
        bg: "bg-emerald-950/30",
        text: "text-emerald-200",
      };
    default:
      return {
        border: "border-neutral-700",
        bg: "bg-neutral-900/50",
        text: "text-neutral-300",
      };
  }
}
