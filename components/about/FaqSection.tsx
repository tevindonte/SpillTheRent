import Link from "next/link";
import { FAQ_ITEMS } from "@/lib/about/faq";

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-16">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        FAQ
      </h2>
      <p className="mt-2 text-sm text-neutral-500">
        Common questions about data, reviews, and how spillthe.rent works.
      </p>
      <div className="mt-4 divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/40">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} className="group">
            <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-medium text-neutral-100 transition-colors hover:text-orange-400 [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-3">
                {item.question}
                <Chevron />
              </span>
            </summary>
            <div className="px-4 pb-4 text-sm leading-relaxed text-neutral-400">
              {item.question === "What is The Receipt?" ? (
                <p>
                  The Receipt is our rent calculator that shows you what
                  you&apos;re actually paying versus what a landlord is
                  advertising. Landlords often advertise a listed rent but offer
                  concessions like one free month.{" "}
                  <Link
                    href="/calculator"
                    className="text-orange-400 hover:text-orange-300"
                  >
                    Open The Receipt
                  </Link>{" "}
                  to see your real average monthly cost over your lease term.
                </p>
              ) : (
                <p>{item.answer}</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600 transition-transform group-open:rotate-180"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
