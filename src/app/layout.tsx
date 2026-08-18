import type { Metadata } from "next";
import "./globals.css";

import { AuthProvider } from "@/features/auth/components/AuthProvider";
import { SchedulingProvider } from "@/features/scheduling/components/SchedulingProvider";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.miturnolisto.com";
const siteName = "MiTurnoListo";
const siteDescription = "MiTurnoListo es una app simple para gestionar turnos online, agenda, servicios, empleados, pagos y reservas para negocios de servicios.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`
  },
  description: siteDescription,
  applicationName: siteName,
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  keywords: [
    "MiTurnoListo",
    "mi turno listo",
    "turnos online",
    "agenda online",
    "reservas online",
    "sistema de turnos",
    "gestion de turnos",
    "turnos para peluquerias",
    "turnos para consultorios",
    "agenda para negocios"
  ],
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "/",
    siteName,
    title: siteName,
    description: siteDescription,
    images: [
      {
        url: "/branding/logo-wide.png",
        width: 1200,
        height: 630,
        alt: siteName
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/branding/logo-wide.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  icons: {
    icon: [
      { url: "/branding/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/branding/favicon-192x192.png", sizes: "192x192", type: "image/png" }
    ],
    shortcut: "/branding/favicon-32x32.png",
    apple: "/branding/apple-touch-icon.png"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <SchedulingProvider>{children}</SchedulingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
