import type { Metadata } from "next";
import { TIKTOK_VIEWS_LABEL } from "@/lib/visitor-stats";

export const metadata: Metadata = {
  title: "About",
  description: `About spillthe.rent: FAQ, contact, and rental intel for Manhattan, Brooklyn, Queens, North Jersey & Boston. Seen by ${TIKTOK_VIEWS_LABEL} on TikTok. Follow @spilltherent on Instagram.`,
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
