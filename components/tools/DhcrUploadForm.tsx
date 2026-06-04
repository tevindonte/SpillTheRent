"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { formatRent } from "@/lib/format";

type DhcrBedroomRent = {
  bedrooms: number | null;
  label: string;
  amount: number;
};

type DhcrParsed = {
  rent_lines: { amount: number; context: string }[];
  bedroom_rents: DhcrBedroomRent[];
  suggested_legal_rent: number | null;
  max_rent_in_doc: number | null;
  overcharge_hint: boolean;
};

export function DhcrUploadForm() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [complexId, setComplexId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [parsed, setParsed] = useState<DhcrParsed | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setStatus("error");
      setMessage("Sign in to upload your DHCR rent history.");
      return;
    }
    if (!file) {
      setStatus("error");
      setMessage("Choose a PDF file.");
      return;
    }

    setStatus("loading");
    setMessage("");
    setParsed(null);

    const form = new FormData();
    form.append("file", file);
    if (complexId.trim()) form.append("complexId", complexId.trim());

    try {
      const res = await fetch("/api/dhcr/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setStatus("ok");
      setMessage(data.message ?? "Uploaded successfully.");
      setParsed(data.parsed ?? null);
      setFile(null);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
    }
  }

  if (!user) {
    return (
      <p className="mt-4 text-sm text-neutral-400">
        <Link href="/login" className="text-orange-400 hover:underline">
          Sign in
        </Link>{" "}
        to upload your DHCR rent history PDF (beta).
      </p>
    );
  }

  const labeledBedrooms = parsed?.bedroom_rents?.filter((r) => r.bedrooms != null) ?? [];

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-400">
        Upload DHCR rent history (beta)
      </h2>
      <p className="text-xs text-neutral-500">
        We extract legal rent by bedroom when the PDF mentions BR/studio. Link a
        building ID from the map (<code className="text-neutral-400">?building=uuid</code>)
        to save rents on that building.
      </p>
      <input
        type="text"
        value={complexId}
        onChange={(e) => setComplexId(e.target.value)}
        placeholder="Building ID (recommended)"
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200"
      />
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="w-full text-xs text-neutral-400"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-orange-400 disabled:opacity-50"
      >
        {status === "loading" ? "Parsing PDF…" : "Upload & parse"}
      </button>
      {message && (
        <p
          className={`text-sm ${status === "error" ? "text-red-400" : "text-emerald-400"}`}
        >
          {message}
        </p>
      )}

      {parsed && (
        <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/80 p-4 text-sm">
          {parsed.overcharge_hint && (
            <p className="mb-2 font-medium text-amber-300">
              Possible overcharge pattern — verify with DHCR or a tenant attorney.
            </p>
          )}
          {labeledBedrooms.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-neutral-400">By bedroom</p>
              <ul className="mt-1 space-y-1">
                {labeledBedrooms.map((row) => (
                  <li key={`${row.label}-${row.amount}`} className="text-neutral-300">
                    <strong>{row.label}</strong>: {formatRent(row.amount)}/mo
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parsed.suggested_legal_rent != null && (
            <p className="text-neutral-300">
              Document mid-range:{" "}
              <strong>{formatRent(parsed.suggested_legal_rent)}/mo</strong>
              {parsed.max_rent_in_doc != null &&
                parsed.max_rent_in_doc !== parsed.suggested_legal_rent && (
                  <>
                    {" "}
                    · high: <strong>{formatRent(parsed.max_rent_in_doc)}/mo</strong>
                  </>
                )}
            </p>
          )}
          {parsed.rent_lines.length > 0 && labeledBedrooms.length === 0 && (
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-neutral-500">
              {parsed.rent_lines.slice(0, 12).map((line) => (
                <li key={line.amount}>
                  {formatRent(line.amount)}/mo — {line.context.slice(0, 80)}…
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10px] text-neutral-600">
            Automated extraction — not legal advice. Official DHCR letter controls.
          </p>
        </div>
      )}
    </form>
  );
}
