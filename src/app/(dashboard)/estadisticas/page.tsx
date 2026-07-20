"use client";

import { StatisticsView } from "@/features/scheduling/components/StatisticsView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function StatisticsPage() {
  const { appointments, employees, services, messages, focusedDate, profile } = useScheduling();
  const isStatisticsLocked = profile.subscriptionTier !== "pro";

  return (
    <StatisticsView
      appointments={appointments}
      employees={employees}
      isLocked={isStatisticsLocked}
      services={services}
      messages={messages}
      referenceDate={focusedDate}
    />
  );
}
