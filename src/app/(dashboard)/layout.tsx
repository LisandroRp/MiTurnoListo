import { ReactNode, Suspense } from "react";

import { ProtectedDashboard } from "@/features/auth/components/ProtectedDashboard";
import { WorkspaceLoadingState } from "@/components/composed/WorkspaceLoadingState";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<WorkspaceLoadingState />}>
      <ProtectedDashboard>{children}</ProtectedDashboard>
    </Suspense>
  );
}
