import type { MetadataRoute } from "next";

import { verticalLandingList } from "@/features/landing/verticals";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.miturnolisto.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${siteUrl}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4
    },
    ...verticalLandingList.map((vertical) => ({
      url: `${siteUrl}${vertical.path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.85
    }))
  ];
}
