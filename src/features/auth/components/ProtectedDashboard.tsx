"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { WorkspaceLoadingState } from "@/components/composed/WorkspaceLoadingState";
import { AppShell } from "@/features/scheduling/components/AppShell";
import { useAuth } from "@/features/auth/components/AuthProvider";

export function ProtectedDashboard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWaitingForAuth = status === "loading" || status === "bootstrapping";

  useEffect(() => {
    if (status !== "authenticated" && !isWaitingForAuth) {
      const queryString = searchParams.toString();
      const nextPath = queryString ? `${pathname}?${queryString}` : pathname;

      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [isWaitingForAuth, pathname, router, searchParams, status]);

  if (status !== "authenticated") {
    return <WorkspaceLoadingState />;
  }

  return <AppShell>{children}</AppShell>;
}
