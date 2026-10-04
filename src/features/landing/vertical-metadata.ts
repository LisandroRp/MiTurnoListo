import type { Metadata } from "next";

import { getSiteUrl } from "@/features/landing/landing-content";
import { VerticalLandingConfig } from "@/features/landing/verticals";

export function buildVerticalMetadata(config: VerticalLandingConfig): Metadata {
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}${config.path}`;
  const imageUrl = `${url}/opengraph-image`;

  return {
    title: {
      absolute: config.seo.title
    },
    description: config.seo.description,
    alternates: {
      canonical: config.seo.canonical
    },
    openGraph: {
      type: "website",
      locale: "es_AR",
      url,
      siteName: "MiTurnoListo",
      title: config.seo.title,
      description: config.seo.description,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: config.og.title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: config.seo.title,
      description: config.seo.description,
      images: [imageUrl]
    }
  };
}
