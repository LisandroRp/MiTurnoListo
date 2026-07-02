import type { Metadata } from "next";
import "./globals.css";

import { AuthProvider } from "@/features/auth/components/AuthProvider";
import { SchedulingProvider } from "@/features/scheduling/components/SchedulingProvider";

export const metadata: Metadata = {
  title: "MiTurnoListo",
  description: "Appointment management for service businesses.",
  icons: {
    icon: "/branding/favicon.ico",
    shortcut: "/branding/favicon.ico"
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
