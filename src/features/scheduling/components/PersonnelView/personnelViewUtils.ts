import { dayKeys, getScheduleValidationMessage } from "@/features/scheduling/components/AvailabilityEditor";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Appointment, Employee, Service, ServiceSchedule, TimeRange } from "@/features/scheduling/types";

import { PersonnelWizardStep } from "./types";

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "NA";
}

export function getPersonnelStepValidationMessage(step: PersonnelWizardStep, employee: Employee, messages: Messages) {
  if (step === "details" && (!employee.name.trim() || !employee.role.trim())) {
    return messages.personnel.validation.details;
  }

  if (step === "schedule" && getScheduleRangeCount(employee.schedule) === 0) {
    return messages.personnel.validation.schedule;
  }

  if (step === "schedule") {
    return getScheduleValidationMessage(employee.schedule, messages);
  }

  return null;
}

export function getScheduleRangeCount(schedule: ServiceSchedule) {
  return Object.values(schedule).reduce((total, ranges) => total + ranges.length, 0);
}

export function getWeeklyOccupation(
  employee: Employee,
  employeeServices: Service[],
  appointments: Appointment[],
  referenceDate: string
) {
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(referenceDate, index));
  const weeklyAppointments = appointments.filter((appointment) => (
    appointment.employeeId === employee.id &&
    appointment.status !== "cancelled" &&
    weekDates.includes(appointment.date)
  ));
  const estimatedCapacity = weekDates.reduce((total, date) => {
    const ranges = employee.schedule[getDayKeyForDate(date)] ?? [];

    return total + getEstimatedSlotCapacity(ranges, employeeServices);
  }, 0);

  if (estimatedCapacity === 0) {
    return 0;
  }

  return Math.min(100, Math.round((weeklyAppointments.length / estimatedCapacity) * 100));
}

export function formatTodayRanges(ranges: TimeRange[]) {
  if (ranges.length === 0) {
    return "-";
  }

  return ranges.map((range) => `${range.start}-${range.end}`).join(", ");
}

export function getDayKeyForDate(date: string) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const dayByWeekday: Record<number, keyof ServiceSchedule> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday"
  };

  return dayByWeekday[weekday] ?? dayKeys[0];
}

function getEstimatedSlotCapacity(ranges: TimeRange[], services: Service[]) {
  const averageDuration = services.length > 0
    ? services.reduce((total, service) => total + service.durationMinutes, 0) / services.length
    : 60;

  return ranges.reduce((total, range) => {
    const duration = Math.max(getMinutesFromTime(range.end) - getMinutesFromTime(range.start), 0);

    return total + Math.max(Math.floor(duration / averageDuration), 0);
  }, 0);
}

function addDays(date: string, days: number) {
  const nextDate = new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate.toISOString().slice(0, 10);
}

function getMinutesFromTime(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");

  return Number(hours) * 60 + Number(minutes);
}
