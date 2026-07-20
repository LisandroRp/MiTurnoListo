import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiChevronLeft, FiChevronRight, FiSearch, FiTrash2 } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { Messages } from "@/features/scheduling/i18n/messages";
import { freePlanLimits, getMonthlyAppointmentUsage, isFreePlan } from "@/features/scheduling/plan-limits";
import { Appointment, CalendarMode, Employee, Service } from "@/features/scheduling/types";
import { getDateLabel } from "@/features/scheduling/utils/format";

const appointmentToneClasses: Record<string, string> = {
  "employee-coral": "border-employee-coral/35 bg-employee-coral/12 hover:bg-employee-coral/18",
  "employee-blue": "border-employee-blue/35 bg-employee-blue/12 hover:bg-employee-blue/18",
  "employee-green": "border-employee-green/35 bg-employee-green/12 hover:bg-employee-green/18",
  "employee-violet": "border-employee-violet/35 bg-employee-violet/12 hover:bg-employee-violet/18"
};

type CalendarViewProps = {
  messages: Messages;
  employees: Employee[];
  services: Service[];
  appointments: Appointment[];
  subscriptionTier: string;
  mode: CalendarMode;
  focusedDate: string;
  selectedEmployeeIds: string[];
  employeeQuery: string;
  onModeChange: (mode: CalendarMode) => void;
  onFocusedDateChange: (date: string) => void;
  onEmployeeQueryChange: (value: string) => void;
  onToggleEmployee: (employeeId: string) => void;
  onDeleteAppointment: (appointmentId: string) => void;
};

const modes: CalendarMode[] = ["day", "week", "month"];

export function CalendarView({
  messages,
  employees,
  services,
  appointments,
  subscriptionTier,
  mode,
  focusedDate,
  selectedEmployeeIds,
  employeeQuery,
  onModeChange,
  onFocusedDateChange,
  onEmployeeQueryChange,
  onToggleEmployee,
  onDeleteAppointment
}: CalendarViewProps) {
  const visibleEmployees = employees.filter((employee) => selectedEmployeeIds.includes(employee.id));
  const filteredEmployeeOptions = employees.filter((employee) =>
    employee.name.toLowerCase().includes(employeeQuery.toLowerCase())
  );
  const safeFocusedDate = getSafeFocusedDate(focusedDate);
  const visibleAppointments = appointments.filter((appointment) => selectedEmployeeIds.includes(appointment.employeeId));
  const monthlyAppointmentUsage = getMonthlyAppointmentUsage(appointments);
  const shouldShowFreeLimit = isFreePlan(subscriptionTier);
  const hasReachedFreeLimit = monthlyAppointmentUsage >= freePlanLimits.monthlyAppointments;
  const weekDates = getWeekDates(safeFocusedDate);
  const monthDates = getMonthDates(safeFocusedDate);
  const periodLabel = getPeriodLabel(safeFocusedDate, mode);

  function movePeriod(direction: "previous" | "next") {
    const currentDate = new Date(`${safeFocusedDate}T12:00:00`);
    const nextDate = new Date(currentDate);
    const multiplier = direction === "next" ? 1 : -1;

    if (mode === "day") {
      nextDate.setDate(currentDate.getDate() + multiplier);
    }

    if (mode === "week") {
      nextDate.setDate(currentDate.getDate() + multiplier * 7);
    }

    if (mode === "month") {
      nextDate.setMonth(currentDate.getMonth() + multiplier, 1);
    }

    onFocusedDateChange(nextDate.toISOString().slice(0, 10));
  }

  return (
    <div className="grid min-w-0 gap-6">
      <SectionHeader
        eyebrow={messages.calendar.eyebrow}
        title={messages.calendar.title}
        description={messages.calendar.description}
        actions={
          <div className="flex rounded-lg border border-subtle bg-surface p-1">
            {modes.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={mode === item ? "primary" : "ghost"}
                onClick={() => onModeChange(item)}
              >
                {messages.calendar[item]}
              </Button>
            ))}
          </div>
        }
      />

      {shouldShowFreeLimit ? (
        <Card className={cx("border-brand bg-brand-soft", hasReachedFreeLimit ? "ring-2 ring-brand/20" : "")}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-strong">
                {hasReachedFreeLimit ? messages.calendar.freeLimitReachedTitle : messages.calendar.freeLimitTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-primary">
                {formatLimitMessage(
                  hasReachedFreeLimit
                    ? messages.calendar.freeLimitReachedDescription
                    : messages.calendar.freeLimitDescription,
                  monthlyAppointmentUsage,
                  freePlanLimits.monthlyAppointments
                )}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-surface px-3 py-1 text-sm font-bold text-brand-strong">
              {monthlyAppointmentUsage}/{freePlanLimits.monthlyAppointments}
            </span>
          </div>
        </Card>
      ) : null}

      <section className="min-w-0">
        <Card className="min-h-[680px] min-w-0 overflow-visible p-0">
          <div className="flex flex-col gap-4 border-b border-subtle p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-primary">{messages.calendar.visibleEmployees}</h2>
              <p className="text-sm text-muted">
                {visibleEmployees.map((employee) => employee.name).join(", ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-subtle bg-input p-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={messages.calendar.previousPeriod}
                  title={messages.calendar.previousPeriod}
                  onClick={() => movePeriod("previous")}
                >
                  <FiChevronLeft />
                </Button>
                <p className="min-w-44 px-2 text-center text-sm font-semibold capitalize text-primary">{periodLabel}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={messages.calendar.nextPeriod}
                  title={messages.calendar.nextPeriod}
                  onClick={() => movePeriod("next")}
                >
                  <FiChevronRight />
                </Button>
              </div>
              <EmployeeDropdown
                messages={messages}
                employees={filteredEmployeeOptions}
                selectedEmployeeIds={selectedEmployeeIds}
                employeeQuery={employeeQuery}
                onEmployeeQueryChange={onEmployeeQueryChange}
                onToggleEmployee={onToggleEmployee}
              />
              <span className="text-sm font-semibold text-muted">
                {visibleAppointments.length} {messages.calendar.appointments}
              </span>
            </div>
          </div>

          {mode === "day" ? (
            <DayCalendar
              messages={messages}
              focusedDate={safeFocusedDate}
              employees={visibleEmployees}
              services={services}
              appointments={visibleAppointments.filter((appointment) => appointment.date === safeFocusedDate)}
              onDeleteAppointment={onDeleteAppointment}
            />
          ) : null}

          {mode === "week" ? (
            <DateGroupedCalendar
              messages={messages}
              dates={weekDates}
              focusedDate={safeFocusedDate}
              services={services}
              employees={employees}
              appointments={visibleAppointments}
              onDateClick={(date) => {
                onFocusedDateChange(date);
                onModeChange("day");
              }}
              onDeleteAppointment={onDeleteAppointment}
            />
          ) : null}

          {mode === "month" ? (
            <MonthCalendar
              messages={messages}
              dates={monthDates}
              appointments={visibleAppointments}
              focusedDate={safeFocusedDate}
              onDateClick={(date) => {
                onFocusedDateChange(date);
                onModeChange("week");
              }}
            />
          ) : null}
        </Card>
      </section>
    </div>
  );
}

type EmployeeDropdownProps = {
  messages: Messages;
  employees: Employee[];
  selectedEmployeeIds: string[];
  employeeQuery: string;
  onEmployeeQueryChange: (value: string) => void;
  onToggleEmployee: (employeeId: string) => void;
};

function EmployeeDropdown({
  messages,
  employees,
  selectedEmployeeIds,
  employeeQuery,
  onEmployeeQueryChange,
  onToggleEmployee
}: EmployeeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="secondary"
        className="min-w-44 justify-between"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{messages.calendar.employees}</span>
        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-strong">
          {selectedEmployeeIds.length}
        </span>
        <FiChevronDown className={cx("transition-transform", isOpen ? "rotate-180" : "")} aria-hidden="true" />
      </Button>

      {isOpen ? (
        <div className="absolute lg:left-auto lg:right-0 z-20 mt-2 grid w-80 gap-3 rounded-lg border border-subtle bg-surface p-3 shadow-lg">
          <TextField
            label={messages.calendar.searchEmployee}
            value={employeeQuery}
            onChange={(event) => onEmployeeQueryChange(event.target.value)}
            prefix={<FiSearch />}
          />

          <div className="grid max-h-72 gap-2 overflow-y-auto">
            {employees.map((employee) => {
              const isSelected = selectedEmployeeIds.includes(employee.id);

              return (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => onToggleEmployee(employee.id)}
                  className={cx(
                    "flex cursor-pointer items-center justify-between rounded-lg border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-sm",
                    appointmentToneClasses[employee.color],
                    isSelected ? "ring-2 ring-brand/25" : "opacity-80"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-primary">{employee.name}</span>
                    <span className="block truncate text-xs text-muted">{employee.role}</span>
                  </span>
                  <span className="text-xs font-semibold text-muted">
                    {isSelected ? messages.calendar.enabled : messages.calendar.disabled}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatLimitMessage(message: string, count: number, limit: number) {
  return message.replace("{count}", String(count)).replace("{limit}", String(limit));
}

type CalendarContentProps = {
  messages: Messages;
  focusedDate?: string;
  employees: Employee[];
  services: Service[];
  appointments: Appointment[];
  onDeleteAppointment: (appointmentId: string) => void;
};

function DayCalendar({ messages, focusedDate, employees, services, appointments, onDeleteAppointment }: CalendarContentProps) {
  if (appointments.length === 0) {
    return <EmptyCalendar messages={messages} />;
  }

  return (
    <div className="max-w-full min-w-0 overflow-x-auto">
      <div className="border-b border-subtle bg-input px-4 py-3 text-sm font-semibold capitalize text-primary">
        {focusedDate ? getDateLabel(focusedDate) : ""}
      </div>
      <div
        className="grid min-w-[760px]"
        style={{ gridTemplateColumns: `6rem repeat(${Math.max(employees.length, 1)}, minmax(10rem, 1fr))` }}
      >
        <div className="border-b border-r border-subtle bg-surface-strong p-3 text-sm font-semibold text-muted">
          {messages.home.time}
        </div>
        {employees.map((employee) => (
          <div key={employee.id} className="border-b border-r border-subtle bg-surface-strong p-3">
            <p className="text-sm font-bold text-primary">{employee.name}</p>
            <p className="text-xs text-muted">{employee.role}</p>
          </div>
        ))}

        {["09:00", "10:00", "11:00", "12:00", "15:00", "16:00", "17:00"].map((time) => (
          <div key={time} className="contents">
            <div className="border-b border-r border-subtle p-3 text-sm font-semibold text-muted">{time}</div>
            {employees.map((employee) => {
              const appointment = appointments.find((item) => item.employeeId === employee.id && item.startTime.startsWith(time.slice(0, 2)));
              const service = services.find((item) => item.id === appointment?.serviceId);

              return (
                <div key={`${employee.id}-${time}`} className="min-h-24 border-b border-r border-subtle p-2">
                  {appointment ? (
                  <AppointmentCard
                    messages={messages}
                    appointment={appointment}
                    employee={employee}
                    serviceName={service?.name}
                    onDeleteAppointment={onDeleteAppointment}
                  />
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

type DateGroupedCalendarProps = {
  messages: Messages;
  dates: string[];
  focusedDate: string;
  services: Service[];
  employees: Employee[];
  appointments: Appointment[];
  onDateClick: (date: string) => void;
  onDeleteAppointment: (appointmentId: string) => void;
};

function DateGroupedCalendar({
  messages,
  dates,
  focusedDate,
  services,
  employees,
  appointments,
  onDateClick,
  onDeleteAppointment
}: DateGroupedCalendarProps) {
  const focusedDateRef = useRef<HTMLDivElement>(null);
  const todayDate = getTodayDateValue();

  useEffect(() => {
    focusedDateRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
  }, [focusedDate]);

  return (
    <div className="max-w-full min-w-0 overflow-x-auto">
      <div className="flex min-h-[440px] min-w-0 snap-x snap-mandatory items-stretch gap-3 p-5">
        {dates.map((date) => {
          const dayAppointments = appointments.filter((appointment) => appointment.date === date);
          const isFocused = focusedDate === date;
          const isToday = todayDate === date;

          return (
            <div
              key={date}
              ref={isFocused ? focusedDateRef : undefined}
              className={cx(
                "flex h-full w-[86vw] shrink-0 snap-start flex-col rounded-lg border p-4 sm:w-[28rem] lg:w-[32rem]",
                isToday ? "border-brand bg-surface-strong" : "border-subtle bg-input"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onDateClick(date)}
                  className="cursor-pointer text-left font-bold capitalize text-primary hover:text-brand-strong"
                >
                  {getDateLabel(date)}
                </button>
                <span className="text-xs font-semibold text-muted">{dayAppointments.length} {messages.calendar.appointments}</span>
              </div>
              <div className="mt-3 grid flex-1 content-start gap-2">
                {dayAppointments.length > 0 ? dayAppointments.map((appointment) => {
                  const employee = employees.find((item) => item.id === appointment.employeeId);
                  const service = services.find((item) => item.id === appointment.serviceId);

                  return (
                    <AppointmentCard
                      key={appointment.id}
                    messages={messages}
                    appointment={appointment}
                    employee={employee}
                    serviceName={service?.name}
                    employeeName={employee?.name}
                    onDeleteAppointment={onDeleteAppointment}
                    />
                  );
                }) : <p className="text-sm text-muted">{messages.calendar.noAppointments}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type AppointmentCardProps = {
  messages: Messages;
  appointment: Appointment;
  employee?: Employee;
  serviceName?: string;
  employeeName?: string;
  onDeleteAppointment: (appointmentId: string) => void;
};

function AppointmentCard({
  messages,
  appointment,
  employee,
  serviceName,
  employeeName,
  onDeleteAppointment
}: AppointmentCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const appointmentToneClass = employee ? appointmentToneClasses[employee.color] : "border-brand bg-brand-soft";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function deleteAppointment() {
    onDeleteAppointment(appointment.id);
    setIsOpen(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={cx(
          "w-full cursor-pointer rounded-lg border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
          appointmentToneClass
        )}
      >
        <p className="truncate text-sm font-bold text-primary">{appointment.customerName}</p>
        <p className="mt-1 text-xs text-muted">
          {[serviceName, employeeName].filter(Boolean).join(" - ")}
        </p>
        <p className="mt-3 text-xs font-semibold text-brand-strong">
          {appointment.startTime} - {appointment.endTime}
        </p>
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 grid w-48 gap-2 rounded-lg border border-subtle bg-surface p-2 shadow-lg">
          <Button
            size="sm"
            variant="danger"
            icon={<FiTrash2 />}
            className="w-full justify-start"
            onClick={deleteAppointment}
          >
            {messages.actions.delete}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function MonthCalendar({
  messages,
  dates,
  appointments,
  focusedDate,
  onDateClick
}: {
  messages: Messages;
  dates: string[];
  appointments: Appointment[];
  focusedDate: string;
  onDateClick: (date: string) => void;
}) {
  const todayDate = getTodayDateValue();

  return (
    <div className="max-w-full min-w-0 overflow-x-auto">
      <div className="grid min-w-[980px] grid-cols-7 gap-px bg-subtle p-px">
        {dates.map((date) => {
          const dayAppointments = appointments.filter((appointment) => appointment.date === date);
          const isFocused = focusedDate === date;
          const isToday = todayDate === date;

          return (
            <button
              key={date}
              type="button"
              onClick={() => onDateClick(date)}
              className={cx(
                "min-h-28 cursor-pointer p-3 text-left transition-all hover:bg-surface-strong",
                isToday ? "bg-surface-strong shadow-inner" : "bg-surface",
                isFocused ? "ring-2 ring-brand ring-inset" : ""
              )}
            >
              <p className="text-sm font-bold text-primary">{Number(date.slice(-2))}</p>
              <p className="mt-6 text-xs font-semibold text-muted">
                {dayAppointments.length} {messages.calendar.appointments}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyCalendar({ messages }: { messages: Messages }) {
  return (
    <div className="grid min-h-[420px] place-items-center p-8 text-center">
      <p className="max-w-sm text-sm text-muted">{messages.calendar.noAppointments}</p>
    </div>
  );
}

function getSafeFocusedDate(focusedDate: string) {
  const candidate = new Date(`${focusedDate}T12:00:00`);

  if (Number.isNaN(candidate.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return focusedDate;
}

function getTodayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getWeekDates(focusedDate: string) {
  const currentDate = new Date(`${focusedDate}T12:00:00`);
  const dayOfWeek = currentDate.getDay();
  const startDate = new Date(currentDate);
  startDate.setDate(currentDate.getDate() - dayOfWeek);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function getMonthDates(focusedDate: string) {
  const currentDate = new Date(`${focusedDate}T12:00:00`);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${year}-${String(month + 1).padStart(2, "0")}-${day}`;
  });
}

function getPeriodLabel(focusedDate: string, mode: CalendarMode) {
  const date = new Date(`${focusedDate}T12:00:00`);

  if (mode === "day") {
    return getDateLabel(focusedDate);
  }

  if (mode === "week") {
    const weekDates = getWeekDates(focusedDate);
    const start = new Date(`${weekDates[0]}T12:00:00`);
    const end = new Date(`${weekDates[6]}T12:00:00`);

    return `${new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(start)} - ${new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(end)}`;
  }

  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric"
  }).format(date);
}
