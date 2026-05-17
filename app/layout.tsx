import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpillTheRent",
  description: "Manhattan rental intel — map, reviews, and real rent data",
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
      </body>
    </html>
  );
}
