import { cx } from "@/components/ui/utils";
import { dayKeys } from "@/features/scheduling/components/AvailabilityEditor";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Employee, Service } from "@/features/scheduling/types";

const visibleServiceBadgeLimit = 3;

export function WeeklyOccupationBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">{label}</span>
        <span className="font-bold text-primary">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-shell">
        <div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function EmployeeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-bold text-primary">{value}</span>
    </div>
  );
}

export function ServiceBadges({ messages, services }: { messages: Messages; services: Service[] }) {
  const visibleServices = services.slice(0, visibleServiceBadgeLimit);
  const hiddenCount = Math.max(services.length - visibleServiceBadgeLimit, 0);

  if (services.length === 0) {
    return <div className="min-h-14" />;
  }

  return (
    <div className="flex max-h-15 flex-wrap content-start gap-2 overflow-hidden">
      {visibleServices.map((service) => (
        <span key={service.id} className="rounded-full bg-shell px-3 py-1 text-xs font-semibold text-primary">
          {service.name}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="rounded-full bg-shell px-3 py-1 text-xs font-semibold text-primary">
          {messages.personnel.moreServices.replace("{count}", String(hiddenCount))}
        </span>
      ) : null}
    </div>
  );
}

export function WeekdayPills({ employee, messages }: { employee: Employee; messages: Messages }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {dayKeys.map((day) => {
        const isAvailable = (employee.schedule[day] ?? []).length > 0;

        return (
          <span
            key={day}
            className={cx(
              "grid h-7 w-7 place-items-center rounded-full text-xs font-bold",
              isAvailable ? "bg-brand text-on-brand" : "bg-shell text-muted"
            )}
            title={messages.days[day]}
          >
            {getShortDayLabel(messages.days[day])}
          </span>
        );
      })}
    </div>
  );
}

function getShortDayLabel(label: string) {
  return label.slice(0, 1).toUpperCase();
}
