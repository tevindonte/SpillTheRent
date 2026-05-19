import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

const STATIC_ROUTES = ["/", "/calculator", "/leaderboard", "/faq"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return STATIC_ROUTES.map((path) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
