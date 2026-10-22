import { useId, useState } from "react";
import { FiChevronDown, FiUsers } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";
import { getDayKeyForDate } from "@/features/scheduling/components/dashboardTeamUtils";
import { employeeColorClasses } from "@/features/scheduling/components/employeeColors";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Appointment, Employee } from "@/features/scheduling/types";

type DashboardActiveTeamProps = {
  employees: Employee[];
  appointments: Appointment[];
  referenceDate: string;
  messages: Messages;
  onEmployeeClick: (employee: Employee) => void;
};

export function DashboardActiveTeam({ employees, appointments, referenceDate, messages, onEmployeeClick }: DashboardActiveTeamProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const id = useId();
  const day = getDayKeyForDate(referenceDate);

  if (employees.length === 0) {
    return (
      <Card className="flex min-w-0 items-center gap-3 !p-4">
        <FiUsers className="shrink-0 text-lg text-brand-strong" aria-hidden="true" />
        <p className="text-sm font-semibold text-muted">{messages.home.noActiveTeam}</p>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 !p-4">
      <div className="flex items-center gap-3">
        <FiUsers className="shrink-0 text-lg text-brand-strong" aria-hidden="true" />
        <h2 id={`${id}-title`} className="shrink-0 text-base font-bold text-primary">{messages.home.teamToday}</h2>
        <Badge tone="brand">{employees.length}</Badge>
        <div className="hidden min-w-0 flex-1 items-center gap-3 overflow-hidden sm:flex">
          {employees.slice(0, 3).map((employee) => (
            <span key={employee.id} title={employee.name} className="inline-flex min-w-0 items-center gap-2 text-sm text-muted">
              <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", employeeColorClasses[employee.color])} aria-hidden="true" />
              <span className="truncate">{employee.name}</span>
            </span>
          ))}
          {employees.length > 3 ? <span className="shrink-0 text-sm font-semibold text-muted">+{employees.length - 3}</span> : null}
        </div>
        <Button
          variant="secondary"
          size="icon"
          className="ml-auto rounded-full !text-brand-strong"
          aria-expanded={isExpanded}
          aria-controls={`${id}-content`}
          aria-label={isExpanded ? messages.home.collapseTeam : messages.home.expandTeam}
          onClick={() => setIsExpanded((current) => !current)}
        >
          <FiChevronDown aria-hidden="true" className={cx("transition-transform duration-300 motion-reduce:transition-none", isExpanded && "rotate-180")} />
        </Button>
      </div>
      <div
        id={`${id}-content`}
        role="region"
        aria-labelledby={`${id}-title`}
        aria-hidden={!isExpanded}
        inert={!isExpanded}
        className={cx("grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none", isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-4 grid max-h-[34rem] gap-3 overflow-y-auto border-t border-subtle pt-4 sm:grid-cols-2 xl:grid-cols-3">
            {employees.map((employee) => {
              const schedule = employee.schedule[day] ?? [];
              const count = appointments.filter((appointment) => appointment.employeeId === employee.id).length;
              return (
                <button key={employee.id} type="button" onClick={() => onEmployeeClick(employee)} className="grid min-w-0 cursor-pointer gap-3 rounded-lg border border-subtle bg-input p-3 text-left transition-colors hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-on-brand", employeeColorClasses[employee.color])}>{employee.initials}</span>
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate font-semibold text-primary">{employee.name}</span>
                      <span className="text-sm text-muted">{employee.role}</span>
                    </span>
                  </span>
                  <span className="grid gap-1 text-sm leading-tight">
                    <TeamFact label={messages.home.todayHours} value={schedule.length ? schedule.map((range) => `${range.start} - ${range.end}`).join(", ") : messages.home.noTodayHours} />
                    <TeamFact label={messages.home.todayAppointments} value={`${count} ${count === 1 ? messages.calendar.appointment : messages.calendar.appointments}`} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

function TeamFact({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-1 leading-tight">
      <span className="text-xs font-bold uppercase text-muted">{label}</span>
      <span className="text-right font-semibold text-primary">{value}</span>
    </span>
  );
}
