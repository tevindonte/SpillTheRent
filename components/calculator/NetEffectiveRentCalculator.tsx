"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

type FeeMode = "dollar" | "percent";

function parseNum(v: string): number {
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function NetEffectiveRentCalculator() {
  const searchParams = useSearchParams();
  const [listedRent, setListedRent] = useState("");
  const [leaseTerm, setLeaseTerm] = useState("12");
  const [freeMonths, setFreeMonths] = useState("0");
  const [concessions, setConcessions] = useState("0");
  const [brokerFee, setBrokerFee] = useState("0");
  const [feeMode, setFeeMode] = useState<FeeMode>("dollar");
  const [howOpen, setHowOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fromBuilding = searchParams.get("from") === "building";
  const reportCount = parseInt(searchParams.get("reports") ?? "", 10);
  const showPrefillHint =
    fromBuilding &&
    searchParams.get("rent") != null &&
    searchParams.get("rent") !== "" &&
    Number.isFinite(reportCount) &&
    reportCount > 0;

  useEffect(() => {
    const rent = searchParams.get("rent");
    const term = searchParams.get("term");
    const free = searchParams.get("free");
    const conc = searchParams.get("concessions");
    const fee = searchParams.get("broker");
    const mode = searchParams.get("feeMode");
    if (rent) setListedRent(rent);
    else setListedRent("");
    if (term) setLeaseTerm(term);
    if (free) setFreeMonths(free);
    if (conc) setConcessions(conc);
    if (fee) setBrokerFee(fee);
    if (mode === "percent" || mode === "dollar") setFeeMode(mode);
  }, [searchParams]);

  const result = useMemo(() => {
    const rent = parseNum(listedRent);
    const months = Math.max(1, parseInt(leaseTerm, 10) || 12);
    const free = Math.min(3, Math.max(0, parseInt(freeMonths, 10) || 0));
    const conc = parseNum(concessions);
    const feeRaw = parseNum(brokerFee);
    const brokerDollars =
      feeMode === "percent" ? Math.round((rent * months * feeRaw) / 100) : feeRaw;

    const gross = rent * months;
    const freeValue = rent * free;
    const netTotal = gross - freeValue - conc + brokerDollars;
    const netMonthly = netTotal / months;
    const listedAnnual = rent * 12;
    const netAnnual = netMonthly * 12;
    const monthlySavings = rent - netMonthly;
    const totalSavings = gross - netTotal;

    return {
      rent,
      months,
      free,
      brokerDollars,
      netMonthly,
      netTotal,
      listedAnnual,
      netAnnual,
      monthlySavings,
      totalSavings,
    };
  }, [listedRent, leaseTerm, freeMonths, concessions, brokerFee, feeMode]);

  function shareUrl() {
    const params = new URLSearchParams({
      rent: listedRent,
      term: leaseTerm,
      free: freeMonths,
      concessions,
      broker: brokerFee,
      feeMode,
    });
    const url = `${window.location.origin}/calculator?${params}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-50">The Receipt</h1>
        <p className="mt-1 text-sm text-neutral-500">
          What you&apos;re actually paying vs what they&apos;re advertising.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <label className="block text-sm text-neutral-400">
          Listed monthly rent ($)
          <input
            type="text"
            inputMode="decimal"
            value={listedRent}
            onChange={(e) => setListedRent(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
          />
          {showPrefillHint && (
            <span className="mt-1 block text-xs text-neutral-500">
              Pre-filled with median reported rent from {reportCount} tenant
              {reportCount === 1 ? "" : "s"} at this building
            </span>
          )}
        </label>

        <label className="block text-sm text-neutral-400">
          Lease term (months)
          <input
            type="number"
            min={1}
            max={36}
            value={leaseTerm}
            onChange={(e) => setLeaseTerm(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
          />
        </label>

        <label className="block text-sm text-neutral-400">
          Free months offered
          <select
            value={freeMonths}
            onChange={(e) => setFreeMonths(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-neutral-400">
          One-time concessions ($)
          <input
            type="text"
            value={concessions}
            onChange={(e) => setConcessions(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
          />
        </label>

        <div>
          <div className="mb-1 flex items-center justify-between text-sm text-neutral-400">
            <span>Broker fee</span>
            <div className="flex gap-1 rounded-lg border border-neutral-700 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFeeMode("dollar")}
                className={`rounded px-2 py-0.5 ${feeMode === "dollar" ? "bg-orange-500 text-neutral-950" : "text-neutral-500"}`}
              >
                $
              </button>
              <button
                type="button"
                onClick={() => setFeeMode("percent")}
                className={`rounded px-2 py-0.5 ${feeMode === "percent" ? "bg-orange-500 text-neutral-950" : "text-neutral-500"}`}
              >
                %
              </button>
            </div>
          </div>
          <input
            type="text"
            value={brokerFee}
            onChange={(e) => setBrokerFee(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
          />
          {feeMode === "percent" && result.brokerDollars > 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              = ${result.brokerDollars.toLocaleString()} over lease
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-orange-900/40 bg-orange-950/20 p-5">
        <p className="text-sm text-neutral-400">Net effective monthly rent</p>
        <p className="text-3xl font-bold text-orange-400">
          ${Math.round(result.netMonthly).toLocaleString()}
          <span className="text-lg font-normal text-neutral-500">/mo</span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-neutral-500">Total over lease</p>
            <p className="font-medium text-neutral-200">
              ${Math.round(result.netTotal).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-neutral-500">vs listed price</p>
            <p className="font-medium text-emerald-400">
              Save ${Math.round(result.totalSavings).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-neutral-500">Monthly savings</p>
            <p className="font-medium text-emerald-400">
              ${Math.round(result.monthlySavings).toLocaleString()}/mo
            </p>
          </div>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-neutral-500">
            <th className="py-2 text-left font-medium" />
            <th className="py-2 text-right">Listed</th>
            <th className="py-2 text-right text-orange-400">Net Effective</th>
          </tr>
        </thead>
        <tbody className="text-neutral-200">
          <tr className="border-b border-neutral-800/50">
            <td className="py-2">Monthly rent</td>
            <td className="py-2 text-right">${result.rent.toLocaleString()}</td>
            <td className="py-2 text-right text-orange-400">
              ${Math.round(result.netMonthly).toLocaleString()}
            </td>
          </tr>
          <tr className="border-b border-neutral-800/50">
            <td className="py-2">Annual cost</td>
            <td className="py-2 text-right">
              ${result.listedAnnual.toLocaleString()}
            </td>
            <td className="py-2 text-right text-orange-400">
              ${Math.round(result.netAnnual).toLocaleString()}
            </td>
          </tr>
          <tr>
            <td className="py-2">You save</td>
            <td className="py-2 text-right">-</td>
            <td className="py-2 text-right text-emerald-400">
              ${Math.round(result.monthlySavings * 12).toLocaleString()}/yr
            </td>
          </tr>
        </tbody>
      </table>

      <button
        type="button"
        onClick={shareUrl}
        className="w-full rounded-full border border-neutral-700 py-3 text-sm font-medium text-neutral-200 hover:border-orange-500/50"
      >
        {copied ? "Link copied!" : "Share this calculation"}
      </button>

      <div className="rounded-xl border border-neutral-800">
        <button
          type="button"
          onClick={() => setHowOpen(!howOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-neutral-200"
        >
          How does this work?
          <span>{howOpen ? "−" : "+"}</span>
        </button>
        {howOpen && (
          <div className="border-t border-neutral-800 px-4 py-3 text-sm leading-relaxed text-neutral-400">
            <p>
              Net effective rent spreads your real cost over every month of the lease.
              We start with listed rent × lease length, subtract the value of free
              months and one-time concessions, add broker fees, then divide by months.
            </p>
            <p className="mt-2">
              Example: $3,400/mo for 12 months with 1 free month → you pay for 11
              months of rent spread across 12 → about $3,117/mo net effective.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
