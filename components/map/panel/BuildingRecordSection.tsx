"use client";

import type { BuildingSignals } from "@/lib/building-detail";

type BuildingRecordSectionProps = {
  signals: BuildingSignals;
};

function SignalRow({
  icon,
  title,
  badgeClass,
  children,
}: {
  icon: string;
  title: string;
  badgeClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-start gap-2">
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-100">
            {title}
            {badgeClass && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
                Alert
              </span>
            )}
          </p>
          <div className="mt-1 text-xs leading-relaxed text-neutral-400">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function BuildingRecordSection({ signals }: BuildingRecordSectionProps) {
  const currentYear = new Date().getFullYear();
  const hasAny =
    signals.has_bedbug_history ||
    signals.has_active_construction ||
    signals.oath_violation_count > 0 ||
    signals.hp_action_count > 0;

  if (!hasAny) {
    return (
      <div className="mt-5 space-y-2">
        <h3 className="text-sm font-semibold text-neutral-200">Building Record</h3>
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
          <p className="text-sm font-medium text-emerald-400">
            ✅ No major red flags on record
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            No bedbug filings, active construction permits, illegal short-term rental
            citations, or tenant housing court actions found for this address.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-2">
      <h3 className="text-sm font-semibold text-neutral-200">Building Record</h3>

      {signals.has_bedbug_history && (
        <SignalRow
          icon="🐛"
          title="Bedbug History"
          badgeClass="border-red-900/50 bg-red-950/50 text-red-400"
        >
          Officially reported {signals.bedbug_report_count} time
          {signals.bedbug_report_count === 1 ? "" : "s"}.
          {signals.bedbug_last_reported_year != null && (
            <> Last reported: {signals.bedbug_last_reported_year}.</>
          )}
          {signals.bedbug_last_reported_year != null &&
            signals.bedbug_last_reported_year >= currentYear - 2 && (
              <p className="mt-2 text-red-400">
                ⚠️ Recent bedbug activity reported
              </p>
            )}
        </SignalRow>
      )}

      {signals.has_active_construction && (
        <SignalRow icon="🔨" title="Active Construction Permits">
          {signals.active_permit_count} active permit
          {signals.active_permit_count === 1 ? "" : "s"} on file. Expect noise and
          disruption.
        </SignalRow>
      )}

      {signals.oath_violation_count > 0 && (
        <SignalRow icon="🏨" title="Illegal Short-Term Rental Violations">
          {signals.oath_violation_count} citation
          {signals.oath_violation_count === 1 ? "" : "s"} issued for illegal
          Airbnb/hotel activity in this building.
        </SignalRow>
      )}

      {signals.hp_action_count > 0 && (
        <SignalRow
          icon="⚖️"
          title="Tenant Legal Actions"
          badgeClass={
            signals.hp_action_count >= 3
              ? "border-red-900/50 bg-red-950/50 text-red-400"
              : undefined
          }
        >
          Tenants have taken this landlord to housing court{" "}
          {signals.hp_action_count} time{signals.hp_action_count === 1 ? "" : "s"}.
          {signals.hp_action_count >= 3 && (
            <p className="mt-2 text-red-400">
              🚨 Multiple legal actions filed against this landlord
            </p>
          )}
        </SignalRow>
      )}
    </div>
  );
}
