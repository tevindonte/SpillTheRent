"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

export function DhcrUploadForm() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [complexId, setComplexId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

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

    const form = new FormData();
    form.append("file", file);
    if (complexId.trim()) form.append("complexId", complexId.trim());

    try {
      const res = await fetch("/api/dhcr/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setStatus("ok");
      setMessage(data.message ?? "Uploaded successfully.");
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

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-orange-400">
        Beta: upload DHCR PDF
      </h2>
      <p className="text-xs text-neutral-500">
        Optional building ID from the map URL (
        <code className="text-neutral-400">?building=uuid</code>).
      </p>
      <input
        type="text"
        value={complexId}
        onChange={(e) => setComplexId(e.target.value)}
        placeholder="Building ID (optional)"
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
        {status === "loading" ? "Uploading…" : "Upload for overcharge check"}
      </button>
      {message && (
        <p
          className={`text-sm ${status === "error" ? "text-red-400" : "text-emerald-400"}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
