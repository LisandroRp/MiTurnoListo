"use client";

import { DashboardView } from "@/features/scheduling/components/DashboardView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function HomeSectionPage() {
  const { messages, dashboardMetrics, employees, services, appointments, focusedDate } = useScheduling();

  return (
    <DashboardView
      messages={messages}
      metrics={dashboardMetrics}
      employees={employees}
      services={services}
      appointments={appointments}
      referenceDate={focusedDate}
    />
  );
}
