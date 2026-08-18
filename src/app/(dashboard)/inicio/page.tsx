"use client";

import { DashboardView } from "@/features/scheduling/components/DashboardView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function HomeSectionPage() {
  const {
    appointments,
    dashboardMetrics,
    deleteAppointment,
    employees,
    focusedDate,
    markAppointmentPaid,
    messages,
    rescheduleAppointment,
    services
  } = useScheduling();

  return (
    <DashboardView
      messages={messages}
      metrics={dashboardMetrics}
      employees={employees}
      services={services}
      appointments={appointments}
      referenceDate={focusedDate}
      onDeleteAppointment={deleteAppointment}
      onMarkAppointmentPaid={markAppointmentPaid}
      onRescheduleAppointment={rescheduleAppointment}
    />
  );
}
