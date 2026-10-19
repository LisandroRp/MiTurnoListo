import type { Messages } from "@/features/scheduling/i18n/messages";

export const minutesPerCancellationLeadDay = 1440;
export const minutesPerCancellationLeadHour = 60;
export const defaultCancellationLeadMinutes = minutesPerCancellationLeadDay;
export type CancellationLeadUnit = "days" | "hours";

export function cancellationLeadValueToMinutes(value: number, unit: CancellationLeadUnit) {
  return value * (unit === "days" ? minutesPerCancellationLeadDay : minutesPerCancellationLeadHour);
}

export function cancellationLeadMinutesToValue(minutes: number, unit: CancellationLeadUnit) {
  return Math.ceil(minutes / (unit === "days" ? minutesPerCancellationLeadDay : minutesPerCancellationLeadHour));
}

export function getCancellationLeadUnit(minutes: number): CancellationLeadUnit {
  return minutes % minutesPerCancellationLeadDay === 0 ? "days" : "hours";
}

export function normalizeCancellationLeadMinutes(minutes: number) {
  return Math.max(0, Math.ceil(minutes / minutesPerCancellationLeadHour)) * minutesPerCancellationLeadHour;
}

export function hasValidCancellationLeadMinutes(minutes: number) {
  return Number.isSafeInteger(minutes) && minutes >= 0 && minutes % minutesPerCancellationLeadHour === 0;
}

export function getCancellationDeadline(startsAt: Date, leadMinutes: number) {
  return new Date(startsAt.getTime() - leadMinutes * 60 * 1000);
}

export function formatCancellationLeadTime(minutes: number, messages: Messages) {
  if (minutes === 0) {
    return messages.services.cancellationNoLeadTime;
  }

  if (minutes % minutesPerCancellationLeadDay === 0) {
    const days = minutes / minutesPerCancellationLeadDay;
    return `${days} ${days === 1 ? messages.services.daySingular : messages.services.daysShort}`;
  }

  if (minutes % minutesPerCancellationLeadHour === 0) {
    const hours = minutes / minutesPerCancellationLeadHour;
    return `${hours} ${hours === 1 ? messages.services.hourSingular : messages.services.hoursPlural}`;
  }

  return `${minutes} ${minutes === 1 ? messages.services.minuteSingular : messages.services.minutes}`;
}

export function formatCancellationPolicy(minutes: number, messages: Messages) {
  if (minutes === 0) {
    return messages.bookingFlow.cancellationPolicyZero;
  }

  return messages.bookingFlow.cancellationPolicy.replace("{time}", formatCancellationLeadTime(minutes, messages));
}
