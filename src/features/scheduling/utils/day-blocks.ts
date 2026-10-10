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
