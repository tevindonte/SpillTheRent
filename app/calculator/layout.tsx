import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Receipt",
  description:
    "What you're actually paying vs what they're advertising. Decode free months, concessions, and broker fees.",
};

export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
