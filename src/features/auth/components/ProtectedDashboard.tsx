"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { WorkspaceLoadingState } from "@/components/composed/WorkspaceLoadingState";
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
    return <WorkspaceLoadingState />;
  }

  return <AppShell>{children}</AppShell>;
}
