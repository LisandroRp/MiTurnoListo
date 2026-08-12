export const minutesPerCancellationLeadDay = 1440;
export const minimumCancellationLeadDays = 1;
export const minimumCancellationLeadMinutes = minimumCancellationLeadDays * minutesPerCancellationLeadDay;

export function cancellationLeadDaysToMinutes(days: number) {
  return Math.max(days, minimumCancellationLeadDays) * minutesPerCancellationLeadDay;
}

export function cancellationLeadMinutesToDays(minutes: number) {
  return Math.max(Math.ceil(minutes / minutesPerCancellationLeadDay), minimumCancellationLeadDays);
}

export function normalizeCancellationLeadMinutes(minutes: number) {
  return cancellationLeadDaysToMinutes(cancellationLeadMinutesToDays(minutes));
}

export function hasValidCancellationLeadMinutes(minutes: number) {
  return Number.isInteger(minutes) && minutes >= minimumCancellationLeadMinutes;
}
