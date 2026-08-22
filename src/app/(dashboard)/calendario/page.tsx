"use client";

import { CalendarView } from "@/features/scheduling/components/CalendarView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function CalendarSectionPage() {
  const {
    messages,
    employees,
    services,
    appointments,
    businessDayBlocks,
    profile,
    calendarMode,
    focusedDate,
    selectedEmployeeIds,
    employeeQuery,
    setCalendarMode,
    setFocusedDate,
    setEmployeeQuery,
    toggleEmployee,
    saveBusinessDayBlock,
    deleteBusinessDayBlock,
    deleteAppointment,
    markAppointmentPaid,
    rescheduleAppointment
  } = useScheduling();

  return (
    <CalendarView
      messages={messages}
      employees={employees}
      services={services}
      appointments={appointments}
      businessDayBlocks={businessDayBlocks}
      subscriptionTier={profile.subscriptionTier}
      mode={calendarMode}
      focusedDate={focusedDate}
      selectedEmployeeIds={selectedEmployeeIds}
      employeeQuery={employeeQuery}
      onModeChange={setCalendarMode}
      onFocusedDateChange={setFocusedDate}
      onEmployeeQueryChange={setEmployeeQuery}
      onToggleEmployee={toggleEmployee}
      onSaveBusinessDayBlock={saveBusinessDayBlock}
      onDeleteBusinessDayBlock={deleteBusinessDayBlock}
      onDeleteAppointment={deleteAppointment}
      onMarkAppointmentPaid={markAppointmentPaid}
      onRescheduleAppointment={rescheduleAppointment}
    />
  );
}
