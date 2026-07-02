"use client";

import { CalendarView } from "@/features/scheduling/components/CalendarView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function CalendarSectionPage() {
  const {
    messages,
    employees,
    services,
    appointments,
    calendarMode,
    focusedDate,
    selectedEmployeeIds,
    employeeQuery,
    setCalendarMode,
    setFocusedDate,
    setEmployeeQuery,
    toggleEmployee,
    deleteAppointment
  } = useScheduling();

  return (
    <CalendarView
      messages={messages}
      employees={employees}
      services={services}
      appointments={appointments}
      mode={calendarMode}
      focusedDate={focusedDate}
      selectedEmployeeIds={selectedEmployeeIds}
      employeeQuery={employeeQuery}
      onModeChange={setCalendarMode}
      onFocusedDateChange={setFocusedDate}
      onEmployeeQueryChange={setEmployeeQuery}
      onToggleEmployee={toggleEmployee}
      onDeleteAppointment={deleteAppointment}
    />
  );
}
