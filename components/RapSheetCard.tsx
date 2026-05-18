"use client";

import type { BuildingDetail } from "@/lib/building-detail";

export type RapSheetCardProps = {
  detail: BuildingDetail;
};

function formatLocation(detail: BuildingDetail): string {
  const parts = [detail.borough, detail.zip ? `NY ${detail.zip}` : "NY"].filter(
    Boolean
  );
  return parts.join(", ");
}

export function RapSheetCard({ detail }: RapSheetCardProps) {
  const signals: { icon: string; text: string }[] = [];

  if (detail.hpd_open_violations > 0) {
    signals.push({
      icon: "🚨",
      text: `${detail.hpd_open_violations} Active HPD Violation${detail.hpd_open_violations === 1 ? "" : "s"}`,
    });
  }

  if (detail.signals.has_bedbug_history) {
    const year = detail.signals.bedbug_last_reported_year;
    signals.push({
      icon: "🐛",
      text: year ? `Bedbug History (${year})` : "Bedbug History",
    });
  }

  if (detail.signals.hp_action_count > 0) {
    signals.push({
      icon: "⚖️",
      text: `${detail.signals.hp_action_count} Tenant HP Action${detail.signals.hp_action_count === 1 ? "" : "s"}`,
    });
  }

  if (detail.signals.has_active_construction) {
    signals.push({
      icon: "🔨",
      text: "Active Construction Permits",
    });
  }

  if (detail.signals.oath_violation_count > 0) {
    signals.push({
      icon: "🏨",
      text: `${detail.signals.oath_violation_count} Illegal Airbnb Violation${detail.signals.oath_violation_count === 1 ? "" : "s"}`,
    });
  }

  if (detail.is_rent_stabilized) {
    signals.push({ icon: "🏛️", text: "Rent Stabilized" });
  }

  const hasGovernmentSignals =
    detail.hpd_open_violations > 0 ||
    detail.signals.has_bedbug_history ||
    detail.signals.hp_action_count > 0 ||
    detail.signals.has_active_construction ||
    detail.signals.oath_violation_count > 0;

  const spillScore = detail.spill_score;
  const communityLine =
    spillScore != null
      ? `spillthe.rent Score: ${spillScore.toFixed(1)} ★`
      : detail.community_rating != null
        ? `Community Rating: ${detail.community_rating.toFixed(1)} ★`
        : null;

  return (
    <div
      data-rap-sheet-card
      className="w-[400px] rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-6 font-sans text-white"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <p className="text-sm font-semibold text-[#f97316]">spillthe.rent</p>

      <h1 className="mt-6 text-xl font-bold uppercase leading-tight tracking-tight">
        {detail.name}
      </h1>
      <p className="mt-1 text-sm text-neutral-400">{formatLocation(detail)}</p>

      <ul className="mt-6 space-y-2.5 text-sm">
        {!hasGovernmentSignals && !detail.is_rent_stabilized ? (
          <li className="text-emerald-400">✅ No major violations on record</li>
        ) : (
          signals.map((s) => (
            <li key={s.text} className="flex gap-2">
              <span>{s.icon}</span>
              <span>{s.text}</span>
            </li>
          ))
        )}
      </ul>

      <div className="mt-6 space-y-1 border-t border-neutral-800 pt-4 text-sm text-neutral-300">
        {communityLine && <p>{communityLine}</p>}
        {detail.google_rating != null && (
          <p>Google Rating: {detail.google_rating.toFixed(1)} ★</p>
        )}
      </div>

      <div className="mt-8 border-t border-neutral-800 pt-4">
        <p className="text-sm font-semibold text-[#f97316]">spillthe.rent</p>
        <p className="mt-1 text-xs text-neutral-500">
          The tea app for apartments 🍵
        </p>
      </div>
    </div>
  );
}
