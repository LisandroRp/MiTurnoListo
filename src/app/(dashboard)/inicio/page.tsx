"use client";

import { DashboardView } from "@/features/scheduling/components/DashboardView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function HomeSectionPage() {
  const {
    appointments,
    businessId,
    createAppointment,
    dashboardMetrics,
    deleteAppointment,
    employees,
    focusedDate,
    markAppointmentNoShow,
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
      businessId={businessId}
      referenceDate={focusedDate}
      onDeleteAppointment={deleteAppointment}
      onCreateAppointment={createAppointment}
      onMarkAppointmentNoShow={markAppointmentNoShow}
      onMarkAppointmentPaid={markAppointmentPaid}
      onRescheduleAppointment={rescheduleAppointment}
    />
  );
}
