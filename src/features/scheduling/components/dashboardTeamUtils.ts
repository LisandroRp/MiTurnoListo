import { Appointment, Employee, Service } from "@/features/scheduling/types";

export function getEmployeesWorkingOnDate(
  employees: Employee[],
  services: Service[],
  appointments: Appointment[],
  date: string
) {
  const activeServiceIds = new Set(services.filter((service) => !service.isArchived).map((service) => service.id));
  const activeAppointments = appointments.filter((appointment) => (
    appointment.date === date &&
    appointment.status !== "cancelled" &&
    activeServiceIds.has(appointment.serviceId)
  ));
  const appointmentEmployeeIds = new Set(activeAppointments.map((appointment) => appointment.employeeId));
  const dayKey = getDayKeyForDate(date);

  return employees.filter((employee) => (
    !employee.isArchived &&
    (appointmentEmployeeIds.has(employee.id) || (employee.isVisible && (employee.schedule[dayKey] ?? []).length > 0))
  ));
}

export function getDayKeyForDate(date: string) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const dayByWeekday: Record<number, keyof Employee["schedule"]> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday"
  };

  return dayByWeekday[weekday] ?? "monday";
}
