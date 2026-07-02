import type { Metadata } from "next";
import "./globals.css";

import { AuthProvider } from "@/features/auth/components/AuthProvider";
import { SchedulingProvider } from "@/features/scheduling/components/SchedulingProvider";

export const metadata: Metadata = {
  title: "MiTurnoListo",
  description: "Appointment management for service businesses.",
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
    <html lang="en">
      <body>
        <AuthProvider>
          <SchedulingProvider>{children}</SchedulingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
