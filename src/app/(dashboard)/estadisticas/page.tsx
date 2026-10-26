"use client";

import { StatisticsView } from "@/features/scheduling/components/StatisticsView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function StatisticsPage() {
  const { appointments, employees, services, messages, focusedDate, profile, businessDayBlocks, deleteAppointment, markAppointmentPaid, markAppointmentNoShow, rescheduleAppointment } = useScheduling();
  const isStatisticsLocked = profile.subscriptionTier !== "pro";

  return (
    <StatisticsView
      appointments={appointments}
      businessDayBlocks={businessDayBlocks}
      onDeleteAppointment={deleteAppointment}
      onMarkAppointmentPaid={markAppointmentPaid}
      onMarkAppointmentNoShow={markAppointmentNoShow}
      onRescheduleAppointment={rescheduleAppointment}
      employees={employees}
      isLocked={isStatisticsLocked}
      services={services}
      messages={messages}
      referenceDate={focusedDate}
    />
  );
}
