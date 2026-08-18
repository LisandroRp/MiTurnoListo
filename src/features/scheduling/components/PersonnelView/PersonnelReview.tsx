import { dayKeys } from "@/features/scheduling/components/AvailabilityEditor";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Employee } from "@/features/scheduling/types";

import { EmployeeAvatar } from "./EmployeeAvatar";
import { FormSection } from "./FormSection";
import { getScheduleRangeCount } from "./personnelViewUtils";

export function PersonnelReview({ messages, employee }: { messages: Messages; employee: Employee }) {
  const scheduleRangeCount = getScheduleRangeCount(employee.schedule);

  return (
    <FormSection title={messages.personnel.reviewSection} description={messages.personnel.reviewSectionHint}>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div
          className="min-h-56 rounded-lg bg-surface-strong bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: employee.imageUrl ? `url(${employee.imageUrl})` : undefined }}
        />
        <div className="grid content-start gap-4">
          <div className="flex items-start gap-3">
            <EmployeeAvatar employee={employee} />
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold text-primary">{employee.name || messages.personnel.untitledEmployee}</h2>
              <p className="mt-1 text-sm font-semibold text-muted">{employee.role || messages.personnel.emptyRole}</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted">{employee.description || messages.personnel.emptyDescription}</p>
          <ServiceFact label={messages.personnel.schedule} value={`${scheduleRangeCount} ${messages.personnel.ranges}`} />
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-bold text-primary">{messages.personnel.schedule}</h3>
        {scheduleRangeCount > 0 ? (
          <div className="grid gap-2">
            {dayKeys.map((day) => {
              const ranges = employee.schedule[day] ?? [];

              if (ranges.length === 0) {
                return null;
              }

              return (
                <div key={day} className="rounded-lg border border-subtle bg-input p-3">
                  <p className="text-sm font-semibold text-primary">{messages.days[day]}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ranges.map((range) => (
                      <span key={range.id} className="rounded-lg border border-subtle bg-surface px-3 py-1 text-sm font-semibold text-primary">
                        {range.start} - {range.end}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-subtle bg-input p-3 text-sm text-muted">{messages.personnel.emptySchedule}</p>
        )}
      </div>
    </FormSection>
  );
}

function ServiceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-input p-3 text-sm">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold text-primary">{value}</dd>
    </div>
  );
}
