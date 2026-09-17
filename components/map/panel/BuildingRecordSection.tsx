"use client";

import type { BuildingSignals } from "@/lib/building-detail";

type BuildingRecordSectionProps = {
  signals: BuildingSignals;
  hpdOpenViolations: number;
};

function SignalRow({
  icon,
  title,
  badgeClass,
  children,
  titleClassName,
}: {
  icon: string;
  title: string;
  badgeClass?: string;
  children: React.ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-start gap-2">
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`flex flex-wrap items-center gap-2 text-sm font-medium ${titleClassName ?? "text-neutral-100"}`}
          >
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

export function BuildingRecordSection({
  signals,
  hpdOpenViolations,
}: BuildingRecordSectionProps) {
  const currentYear = new Date().getFullYear();
  const courtCount = Math.max(
    signals.hp_action_count ?? 0,
    signals.housing_court_case_count ?? 0
  );
  const hasOwner =
    Boolean(signals.owner_llc?.trim()) || Boolean(signals.owner_name_verified?.trim());
  const hasAny =
    hpdOpenViolations > 0 ||
    signals.has_bedbug_history ||
    signals.has_active_construction ||
    signals.oath_violation_count > 0 ||
    courtCount > 0 ||
    (signals.dob_complaint_count ?? 0) > 0 ||
    (signals.fdny_violation_count ?? 0) > 0 ||
    (signals.dep_violation_count ?? 0) > 0 ||
    (signals.lead_paint_violation_count ?? 0) > 0 ||
    hasOwner;

  if (!hasAny) {
    return (
      <div className="mt-5 space-y-2">
        <h3 className="text-sm font-semibold text-neutral-200">Building Record</h3>
        <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
          <p className="text-sm font-medium text-emerald-400">
            ✅ No major violations on record
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            This building has no open HPD violations, no bedbug reports, and no
            housing court actions on file. That&apos;s a good sign.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-2">
      <h3 className="text-sm font-semibold text-neutral-200">Building Record</h3>

      {hasOwner && (
        <SignalRow icon="🏢" title="Registered Owner">
          {signals.owner_llc?.trim() ? (
            <>
              <p>LLC Owner: {signals.owner_llc.trim()}</p>
              {signals.owner_name_verified?.trim() && (
                <p className="mt-1">Head Officer: {signals.owner_name_verified.trim()}</p>
              )}
            </>
          ) : (
            <p>Owner: {signals.owner_name_verified?.trim()}</p>
          )}
          {signals.owner_phone?.trim() && (
            <p className="mt-1">Phone: {signals.owner_phone.trim()}</p>
          )}
        </SignalRow>
      )}

      {hpdOpenViolations > 0 && (
        <SignalRow icon="🚨" title="HPD Violations">
          {hpdOpenViolations} open violation{hpdOpenViolations === 1 ? "" : "s"} on
          file with NYC Housing Preservation & Development.
        </SignalRow>
      )}

      {(signals.dob_complaint_count ?? 0) > 0 && (
        <SignalRow icon="📋" title="DOB Complaints">
          {signals.dob_complaint_count} building complaint
          {signals.dob_complaint_count === 1 ? "" : "s"} on file with DOB.
        </SignalRow>
      )}

      {(signals.fdny_violation_count ?? 0) > 0 && (
        <SignalRow icon="🚒" title="FDNY Violations">
          {signals.fdny_violation_count} fire safety violation
          {signals.fdny_violation_count === 1 ? "" : "s"} on file.
        </SignalRow>
      )}

      {(signals.dep_violation_count ?? 0) > 0 && (
        <SignalRow icon="💧" title="DEP Violations">
          {signals.dep_violation_count} environmental violation
          {signals.dep_violation_count === 1 ? "" : "s"} on file with DEP.
        </SignalRow>
      )}

      {(signals.lead_paint_violation_count ?? 0) > 0 && (
        <SignalRow
          icon="⚠️"
          title={`${signals.lead_paint_violation_count} open lead paint violation${signals.lead_paint_violation_count === 1 ? "" : "s"}`}
          titleClassName="text-red-400"
          badgeClass="border-red-900/50 bg-red-950/50 text-red-400"
        >
          Especially important for families with young children. Check HPD Online
          for remediation status.
        </SignalRow>
      )}

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

      {courtCount > 0 && (
        <SignalRow
          icon="⚖️"
          title="Tenant Legal Actions"
          badgeClass={
            courtCount >= 3
              ? "border-red-900/50 bg-red-950/50 text-red-400"
              : undefined
          }
        >
          {(signals.housing_court_case_count ?? 0) > 0 ? (
            <>
              {signals.housing_court_case_count} housing court case
              {signals.housing_court_case_count === 1 ? "" : "s"} on file
              {(signals.hp_action_count ?? 0) > 0 && (
                <> (including {signals.hp_action_count} tenant HP action
                {signals.hp_action_count === 1 ? "" : "s"})</>
              )}
              .
            </>
          ) : (
            <>
              Tenants have taken this landlord to housing court{" "}
              {signals.hp_action_count} time
              {signals.hp_action_count === 1 ? "" : "s"}.
            </>
          )}
          {courtCount >= 3 && (
            <p className="mt-2 text-red-400">
              🚨 Multiple legal actions filed against this landlord
            </p>
          )}
        </SignalRow>
      )}
    </div>
  );
}
