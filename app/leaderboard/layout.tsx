import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NYC's Worst Landlords",
  description:
    "Landlord leaderboard ranked by HPD violations, tenant lawsuits, and bedbug reports across NYC.",
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
