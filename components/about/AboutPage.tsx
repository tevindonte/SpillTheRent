"use client";

import { useState } from "react";
import { FaqSection } from "@/components/about/FaqSection";

const INSTAGRAM_URL = "https://www.instagram.com/spilltherent/";

export function AboutPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-10 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-50">About</h1>
        <p className="mt-1 text-sm text-neutral-500">
          The tea app for apartments — built for renters, not landlords.{" "}
          <a href="#faq" className="text-orange-400/90 hover:text-orange-400">
            Jump to FAQ
          </a>
        </p>
      </div>

      <section className="space-y-3 text-sm leading-relaxed text-neutral-300">
        <p>
          <strong className="text-neutral-100">spillthe.rent</strong> maps
          multifamily buildings across Manhattan, Brooklyn, and Long Island City
          so you can see the full picture before you sign a lease.
        </p>
        <p>
          We combine tenant reviews with public data — HPD violations, bedbug
          filings, court cases, construction permits, and rent-stabilization
          records — in one place. No sugar coating, no broker spin.
        </p>
        <p className="text-neutral-500">
          Use <strong className="text-neutral-400">The Receipt</strong> to
          decode free months, concessions, and broker fees into what you&apos;re
          actually paying per month.
        </p>
      </section>

      <FaqSection />

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Social
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          Follow us for updates, new buildings, and rental tea.
        </p>
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm font-medium text-neutral-100 transition-colors hover:border-orange-500/50 hover:text-orange-400"
        >
          <InstagramIcon />
          @spilltherent
        </a>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Contact
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          Questions, corrections, or partnership ideas? Send us a note.
        </p>

        {status === "success" ? (
          <p className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
            Thanks — we got your message and will get back to you soon.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <label className="block text-sm text-neutral-400">
              Name
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
              />
            </label>
            <label className="block text-sm text-neutral-400">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
              />
            </label>
            <label className="block text-sm text-neutral-400">
              Message
              <textarea
                required
                minLength={10}
                maxLength={5000}
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 w-full resize-y rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
              />
            </label>
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
            />
            {status === "error" && errorMsg && (
              <p className="text-sm text-red-400">{errorMsg}</p>
            )}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-orange-400 disabled:opacity-60"
            >
              {status === "loading" ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.012-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163a7.127 7.127 0 1 0-7.127 7.127 7.127 7.127 0 0 0 7.127-7.127 7.127 7.127 0 0 0-7.127-7.127zm0 11.787a4.66 4.66 0 1 1 0-9.32 4.66 4.66 0 0 1 0 9.32zm7.906-12.735a1.67 1.67 0 1 1-3.34 0 1.67 1.67 0 0 1 3.34 0z" />
    </svg>
  );
}
