import { FiPlus, FiTrash2 } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { Messages } from "@/features/scheduling/i18n/messages";
import { ServiceSchedule, TimeRange } from "@/features/scheduling/types";

export const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export const maxRangesPerDay = 3;

const timeOptions = Array.from({ length: 29 }, (_, index) => {
  const hour = String(7 + Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hour}:${minutes}`;
});

type AvailabilityEditorProps = {
  messages: Messages;
  schedule: ServiceSchedule;
  onAddRange: (day: keyof ServiceSchedule) => void;
  onUpdateRange: (day: keyof ServiceSchedule, rangeId: string, field: keyof TimeRange, value: string) => void;
  onRemoveRange: (day: keyof ServiceSchedule, rangeId: string) => void;
};

export function createEmptySchedule(): ServiceSchedule {
  return dayKeys.reduce((schedule, day) => ({ ...schedule, [day]: [] }), {} as ServiceSchedule);
}

export function getScheduleValidationMessage(schedule: ServiceSchedule, messages: Messages) {
  for (const day of dayKeys) {
    const issue = getDayScheduleIssue(schedule[day] ?? [], messages);

    if (issue) {
      return `${messages.days[day]}: ${issue}`;
    }
  }

  return null;
}

export function AvailabilityEditor({
  messages,
  schedule,
  onAddRange,
  onUpdateRange,
  onRemoveRange
}: AvailabilityEditorProps) {
  return (
    <div className="grid gap-3">
      {dayKeys.map((day) => {
        const dayRanges = schedule[day] ?? [];
        const dayIssue = getDayScheduleIssue(dayRanges, messages);
        const reachedMaxRanges = dayRanges.length >= maxRangesPerDay;

        return (
          <div key={day} className="rounded-lg border border-subtle bg-input p-3">
            <div className="flex w-full items-center justify-between gap-3">
              <p className="text-sm font-semibold text-primary">{messages.days[day]}</p>
              <Button
                size="sm"
                variant="ghost"
                icon={<FiPlus />}
                disabled={reachedMaxRanges}
                title={reachedMaxRanges ? messages.services.validation.maxScheduleRanges : messages.actions.newRange}
                onClick={() => onAddRange(day)}
              >
                {messages.actions.newRange}
              </Button>
            </div>
            {dayRanges.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {dayRanges.map((range) => (
                  <div key={range.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <SelectField
                      aria-label={`${messages.days[day]} inicio`}
                      value={range.start}
                      onChange={(event) => onUpdateRange(day, range.id, "start", event.target.value)}
                      className="h-10 rounded-lg bg-surface"
                      options={timeOptions.map((option) => ({ value: option, label: option }))}
                    />
                    <SelectField
                      aria-label={`${messages.days[day]} fin`}
                      value={range.end}
                      onChange={(event) => onUpdateRange(day, range.id, "end", event.target.value)}
                      className="h-10 rounded-lg bg-surface"
                      options={timeOptions.map((option) => ({ value: option, label: option }))}
                    />
                    <Button size="icon" variant="ghost" aria-label={messages.actions.delete} onClick={() => onRemoveRange(day, range.id)}>
                      <FiTrash2 />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            {dayIssue ? (
              <p className="mt-2 rounded-lg border border-danger bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
                {dayIssue}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function getDayScheduleIssue(ranges: TimeRange[], messages: Messages) {
  if (ranges.length > maxRangesPerDay) {
    return messages.services.validation.maxScheduleRanges;
  }

  const orderedRanges = ranges
    .map((range) => ({
      ...range,
      endMinutes: getMinutesFromTime(range.end),
      startMinutes: getMinutesFromTime(range.start)
    }))
    .sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes);

  for (let index = 0; index < orderedRanges.length; index += 1) {
    const range = orderedRanges[index];
    const nextRange = orderedRanges[index + 1];

    if (range.endMinutes <= range.startMinutes) {
      return messages.services.validation.invalidScheduleRange;
    }

    if (!nextRange) {
      continue;
    }

    if (range.startMinutes === nextRange.startMinutes && range.endMinutes === nextRange.endMinutes) {
      return messages.services.validation.duplicateScheduleRange;
    }

    if (range.endMinutes > nextRange.startMinutes) {
      return messages.services.validation.overlappingScheduleRange;
    }
  }

  return null;
}

function getMinutesFromTime(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");

  return Number(hours) * 60 + Number(minutes);
}
