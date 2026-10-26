import type { Appointment } from "../types";

export type AppointmentOrder = "activity" | "nameAsc" | "nameDesc" | "newest" | "oldest";

function timestamp(value?: string) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortAppointments(appointments: readonly Appointment[], order: AppointmentOrder): Appointment[] {
  const names = new Intl.Collator("es", { sensitivity: "base", numeric: true });
  const scheduled = (appointment: Appointment) => `${appointment.date}T${appointment.startTime}`;
  const activity = (appointment: Appointment) => timestamp(appointment.paymentConfirmedAt) || timestamp(appointment.createdAt);
  return [...appointments].sort((left, right) => {
    let difference = 0;
    if (order === "activity") difference = activity(right) - activity(left);
    else if (order === "nameAsc") difference = names.compare(left.customerName, right.customerName);
    else if (order === "nameDesc") difference = names.compare(right.customerName, left.customerName);
    else if (order === "oldest") difference = scheduled(left).localeCompare(scheduled(right));
    else difference = scheduled(right).localeCompare(scheduled(left));
    return difference || scheduled(right).localeCompare(scheduled(left)) || left.id.localeCompare(right.id);
  });
}
