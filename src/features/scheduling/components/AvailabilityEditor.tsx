import { FiPlus, FiTrash2 } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Messages } from "@/features/scheduling/i18n/messages";
import { ServiceSchedule, TimeRange } from "@/features/scheduling/types";

export const dayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

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

export function AvailabilityEditor({
  messages,
  schedule,
  onAddRange,
  onUpdateRange,
  onRemoveRange
}: AvailabilityEditorProps) {
  return (
    <div className="grid gap-3">
      {dayKeys.map((day) => (
        <div key={day} className="rounded-lg border border-subtle bg-input p-3">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-sm font-semibold text-primary">{messages.days[day]}</p>
            <Button size="sm" variant="ghost" icon={<FiPlus />} onClick={() => onAddRange(day)}>
              {messages.actions.newRange}
            </Button>
          </div>
          {schedule[day].length > 0 ? (
            <div className="mt-3 grid gap-2">
              {schedule[day].map((range) => (
                <div key={range.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <select
                    value={range.start}
                    onChange={(event) => onUpdateRange(day, range.id, "start", event.target.value)}
                    className="h-10 cursor-pointer rounded-lg border border-subtle bg-surface px-2 text-sm text-primary"
                  >
                    {timeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <select
                    value={range.end}
                    onChange={(event) => onUpdateRange(day, range.id, "end", event.target.value)}
                    className="h-10 cursor-pointer rounded-lg border border-subtle bg-surface px-2 text-sm text-primary"
                  >
                    {timeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <Button size="icon" variant="ghost" aria-label={messages.actions.delete} onClick={() => onRemoveRange(day, range.id)}>
                    <FiTrash2 />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
