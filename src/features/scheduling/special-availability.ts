import type { SpecialAvailability } from "./types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isValidSpecialAvailability(value: unknown): value is SpecialAvailability {
  if (!value || typeof value !== "object") return false;
  const opening = value as Partial<SpecialAvailability>;
  if (typeof opening.id !== "string" || !uuidPattern.test(opening.id) || typeof opening.serviceId !== "string" || !uuidPattern.test(opening.serviceId)) return false;
  if (typeof opening.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(opening.date)) return false;
  const date = new Date(`${opening.date}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== opening.date) return false;
  return typeof opening.start === "string" && timePattern.test(opening.start)
    && typeof opening.end === "string" && timePattern.test(opening.end) && opening.start < opening.end
    && Array.isArray(opening.employeeIds) && opening.employeeIds.length > 0 && opening.employeeIds.length <= 100
    && opening.employeeIds.every((id) => typeof id === "string" && uuidPattern.test(id))
    && new Set(opening.employeeIds).size === opening.employeeIds.length;
}
