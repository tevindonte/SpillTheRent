import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for spillthe.rent and the Chrome extension.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-2xl px-4 py-12">
      <Link href="/" className="text-xs text-neutral-500 hover:text-orange-400">
        ← Map
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-neutral-50">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-neutral-500">Last updated: May 2026</p>

      <div className="prose prose-invert mt-8 max-w-none space-y-6 text-sm leading-relaxed text-neutral-300">
        <section>
          <h2 className="text-base font-semibold text-neutral-100">
            spillthe.rent website
          </h2>
          <p>
            spillthe.rent provides NYC rental building research (HPD violations,
            tenant reviews, rent reports). If you create an account, we store
            your profile, submissions, and watchlist through our authentication
            provider (Supabase). We do not sell your personal data.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-100">
            Chrome extension
          </h2>
          <p>
            The spillthe.rent browser extension runs on StreetEasy, Zillow, and
            Apartments.com listing pages you visit. When you open a listing, the
            extension may send the page address or title to spillthe.rent to
            match a building in our database and show HPD violation counts. We do
            not read your passwords, messages, or browsing history outside those
            listing sites.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-400">
            <li>
              <strong className="text-neutral-300">Storage:</strong> optional
              API base URL you set in the extension popup (stored locally in
              Chrome sync storage).
            </li>
            <li>
              <strong className="text-neutral-300">Network:</strong> requests
              to spillthe.rent only (e.g. building match API).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-100">Analytics</h2>
          <p>
            We may use privacy-friendly analytics (e.g. Plausible) on the
            website to understand traffic. The extension does not include
            third-party ad trackers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-neutral-100">Contact</h2>
          <p>
            Questions:{" "}
            <Link href="/about" className="text-orange-400 hover:underline">
              About / contact
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
