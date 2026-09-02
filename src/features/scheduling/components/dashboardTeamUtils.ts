import type { Employee } from "@/features/scheduling/types";

export function getEmployeesWorkingNowOnDate(
  employees: Employee[],
  date: string,
  now = new Date()
) {
  if (date !== formatDateInputValue(now)) {
    return [];
  }

  const dayKey = getDayKeyForDate(date);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return employees.filter((employee) => (
    !employee.isArchived &&
    employee.isVisible &&
    (employee.schedule[dayKey] ?? []).some((range) => isTimeInRange(currentMinutes, range.start, range.end))
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

function isTimeInRange(currentMinutes: number, start: string, end: string) {
  const startMinutes = getTimeMinutes(start);
  const endMinutes = getTimeMinutes(end);

  if (endMinutes <= startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

function getTimeMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");

  return Number(hours) * 60 + Number(minutes);
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
