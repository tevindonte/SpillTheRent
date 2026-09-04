import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "About spillthe.rent: FAQ, contact, and NYC rental intel for Manhattan, Brooklyn & LIC. Follow @spilltherent on Instagram.",
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
