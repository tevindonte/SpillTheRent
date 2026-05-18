import Link from "next/link";
import { FaqSection } from "@/components/about/FaqSection";

export const metadata = {
  title: "FAQ",
  description: "Frequently asked questions about spillthe.rent",
};

export default function FaqPage() {
  return (
    <div className="min-h-[calc(100vh-3rem)] pt-12">
      <div className="mx-auto max-w-lg px-4 py-8">
        <Link
          href="/"
          className="text-xs text-neutral-500 hover:text-orange-400"
        >
          ← Back to map
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-neutral-50">FAQ</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Everything you need to know about spillthe.rent
        </p>
        <div className="mt-8">
          <FaqSection />
        </div>
      </div>
    </div>
  );
}
