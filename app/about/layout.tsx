import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "About spillthe.rent: FAQ, contact, and rental intel for Manhattan, Brooklyn, Queens & Jersey City. Follow @spilltherent on Instagram.",
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
