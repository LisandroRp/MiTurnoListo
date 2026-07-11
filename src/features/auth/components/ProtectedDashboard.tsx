"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { BrandMark } from "@/components/composed/BrandMark";
import { Card } from "@/components/ui/Card";
import { AppShell } from "@/features/scheduling/components/AppShell";
import { useAuth } from "@/features/auth/components/AuthProvider";

export function ProtectedDashboard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== "authenticated" && status !== "loading") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, status]);

  if (status !== "authenticated") {
    return (
      <main className="grid min-h-screen place-items-center bg-shell p-6">
        <Card className="w-full max-w-sm text-center">
          <BrandMark variant="compact" size="md" align="center" className="brand-bounce mx-auto" priority />
          <h1 className="mt-3 text-xl font-bold text-primary">Preparando tu espacio...</h1>
        </Card>
      </main>
    );
  }

  return <AppShell>{children}</AppShell>;
}
