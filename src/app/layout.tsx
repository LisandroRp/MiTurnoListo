import type { Metadata } from "next";
import "./globals.css";

import { AuthProvider } from "@/features/auth/components/AuthProvider";
import { SchedulingProvider } from "@/features/scheduling/components/SchedulingProvider";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.miturnolisto.com";
const siteName = "MiTurnoListo";
const siteDescription = "MiTurnoListo es una agenda virtual y organizador de turnos online para negocios de servicios. Gestiona reservas, horarios, personal, pagos y clientes desde un solo lugar.";

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
    "agenda virtual",
    "agenda online",
    "reservas online",
    "organizador de turnos",
    "sistema de turnos",
    "sistema de reservas online",
    "software de turnos",
    "gestion de turnos",
    "gestion de reservas",
    "calendario de turnos",
    "turnos para peluquerias",
    "turnos para consultorios",
    "turnos para centros de estetica",
    "turnos para estudios profesionales",
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
      { url: "/branding/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/branding/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/branding/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/branding/favicon-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    shortcut: "/branding/favicon-48x48.png",
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
