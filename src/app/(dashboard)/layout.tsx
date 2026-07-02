import { ReactNode } from "react";

import { ProtectedDashboard } from "@/features/auth/components/ProtectedDashboard";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <ProtectedDashboard>{children}</ProtectedDashboard>;
}
