import type { Messages } from "../i18n/messages";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

export function getDateLabel(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date(`${date}T12:00:00`));
}

export function formatServiceDuration(value: number, copy: Messages["services"]) {
  const total = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return [
    hours ? `${hours} ${hours === 1 ? copy.durationHour : copy.durationHours}` : "",
    minutes || !hours ? `${minutes} ${minutes === 1 ? copy.durationMinute : copy.minutes}` : ""
  ].filter(Boolean).join(" ");
}
