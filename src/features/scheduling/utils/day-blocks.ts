import type { BusinessDayBlock } from "@/features/scheduling/types";

export type DayBlockTab = "business" | "employee";

export function getVisibleDayBlocksForTab(
  dayBlocks: BusinessDayBlock[],
  tab: DayBlockTab,
  minimumDate: string
) {
  return dayBlocks
    .filter((block) => block.endsOn >= minimumDate && (tab === "employee" ? Boolean(block.employeeId) : !block.employeeId))
    .sort((left, right) => left.startsOn.localeCompare(right.startsOn));
}

export function getTimedBlockEnd(startTime: string, hours: string, minutes: string): string | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^\d+$/.test(hours) || !/^\d+$/.test(minutes)) return null;
  const duration = Number(hours) * 60 + Number(minutes);
  if (Number(hours) > 24 || Number(minutes) > 59 || duration <= 0) return null;
  const end = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3)) + duration;
  if (end > 1440) return null;
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

export function isValidDayBlockTimeRange(block: BusinessDayBlock): boolean {
  const { startTime, endTime } = block;
  if (startTime == null && endTime == null) return true;
  return Boolean(block.employeeId && block.startsOn === block.endsOn &&
    typeof startTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) &&
    typeof endTime === "string" && /^(?:([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(endTime) && startTime < endTime);
}
