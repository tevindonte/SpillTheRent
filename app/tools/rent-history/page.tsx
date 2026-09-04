import type { Metadata } from "next";
import Link from "next/link";
import { DhcrUploadForm } from "@/components/tools/DhcrUploadForm";
import { getSiteOrigin } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Rent History & Overcharge Check · spillthe.rent",
  description:
    "Guide to DHCR rent history for NYC rent-stabilized tenants. Official workflow and what spillthe.rent will automate next.",
  alternates: { canonical: "/tools/rent-history" },
};

export default function RentHistoryToolPage() {
  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-xl px-4 py-12">
      <Link href="/" className="text-xs text-neutral-500 hover:text-orange-400">
        ← Map
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-neutral-50">
        Rent history & overcharge check
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-400">
        If you&apos;re in a <strong className="text-neutral-300">rent-stabilized</strong>{" "}
        apartment, your legal maximum rent is tied to DHCR registration history, not what the
        broker claims. spillthe.rent is building a guided tool to request your official history
        and flag illegal increases.
      </p>

      <section className="mt-8 space-y-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 text-sm text-neutral-300">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          What you can do today (free)
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Open your building on the{" "}
            <Link href="/" className="text-orange-400 hover:underline">
              map
            </Link>{" "}
            and confirm it&apos;s marked rent-stabilized.
          </li>
          <li>
            Request your rent history from{" "}
            <a
              href="https://www.nyc.gov/site/hpd/renters/rent-stabilization.page"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:underline"
            >
              DHCR
            </a>{" "}
            (online or by mail; can take weeks).
          </li>
          <li>
            Compare the registered rent to what you&apos;re paying; report your rent on
            spillthe.rent to help other tenants.
          </li>
        </ol>
      </section>

      <section className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-5">
        <DhcrUploadForm />
        <p className="mt-3 text-xs text-neutral-500">
          Paid automated overcharge analysis (~$9.99) coming after we validate parsing
          accuracy. Questions?{" "}
          <Link href="/about" className="text-orange-400 hover:underline">
            Contact us
          </Link>
          .
        </p>
      </section>

      <p className="mt-8 text-[11px] text-neutral-600">
        Not legal advice. For disputes, consult a tenant attorney or{" "}
        <a
          href="https://www.metcouncilonhousing.org/help-and-answers/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-neutral-400"
        >
          Met Council on Housing
        </a>
        .
      </p>
      <p className="mt-2 text-[10px] text-neutral-700">{getSiteOrigin()}/tools/rent-history</p>
    </div>
  );
}
