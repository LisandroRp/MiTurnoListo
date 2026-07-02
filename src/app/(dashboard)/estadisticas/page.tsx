"use client";

import { StatisticsView } from "@/features/scheduling/components/StatisticsView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function StatisticsPage() {
  const { appointments, employees, services, messages, focusedDate } = useScheduling();

  return (
    <StatisticsView
      appointments={appointments}
      employees={employees}
      services={services}
      messages={messages}
      referenceDate={focusedDate}
    />
  );
}
