import type { Metadata } from "next";
import { Analytics } from "@/components/Analytics";
import { Navbar } from "@/components/layout/Navbar";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, getSiteOrigin } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteOrigin()),
  title: {
    default: DEFAULT_TITLE,
    template: "%s · spillthe.rent",
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "spillthe.rent",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen overflow-x-hidden bg-[#0a0a0a] antialiased text-neutral-100">
        <Navbar />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
