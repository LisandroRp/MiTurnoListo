import { ReactNode, useEffect, useRef, useState } from "react";
import {
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiMail,
  FiPhone,
  FiSearch,
  FiTrash2,
  FiUser,
  FiX
} from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { getAvailableSlotsForEmployee } from "@/features/booking-flow/utils/booking";
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
  onDeleteAppointment: (appointmentId: string) => Promise<boolean> | void;
  onMarkAppointmentPaid: (appointmentId: string) => Promise<boolean> | void;
  onRescheduleAppointment: (appointmentId: string, date: string, employeeId: string) => Promise<boolean> | void;
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
  onDeleteAppointment,
  onMarkAppointmentPaid,
  onRescheduleAppointment
}: CalendarViewProps) {
  const selectableEmployees = employees.filter((employee) => !employee.isArchived);
  const selectableEmployeeIds = new Set(selectableEmployees.map((employee) => employee.id));
  const visibleEmployees = selectableEmployees.filter((employee) => selectedEmployeeIds.includes(employee.id));
  const filteredEmployeeOptions = selectableEmployees.filter((employee) =>
    employee.name.toLowerCase().includes(employeeQuery.toLowerCase())
  );
  const safeFocusedDate = getSafeFocusedDate(focusedDate);
  const activeAppointments = appointments.filter((appointment) => appointment.status !== "cancelled");
  const visibleAppointments = appointments.filter((appointment) => (
    appointment.status !== "cancelled" &&
    selectableEmployeeIds.has(appointment.employeeId) &&
    selectedEmployeeIds.includes(appointment.employeeId)
  ));
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
              allEmployees={employees}
              services={services}
              allAppointments={activeAppointments}
              appointments={visibleAppointments.filter((appointment) => appointment.date === safeFocusedDate)}
              onDeleteAppointment={onDeleteAppointment}
              onMarkAppointmentPaid={onMarkAppointmentPaid}
              onRescheduleAppointment={onRescheduleAppointment}
            />
          ) : null}

          {mode === "week" ? (
            <DateGroupedCalendar
              messages={messages}
              dates={weekDates}
              focusedDate={safeFocusedDate}
              services={services}
              employees={employees}
              allAppointments={activeAppointments}
              appointments={visibleAppointments}
              onDateClick={(date) => {
                onFocusedDateChange(date);
                onModeChange("day");
              }}
              onDeleteAppointment={onDeleteAppointment}
              onMarkAppointmentPaid={onMarkAppointmentPaid}
              onRescheduleAppointment={onRescheduleAppointment}
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

          <div className="grid max-h-72 gap-2 overflow-y-auto py-2">
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
                    isSelected ? "ring-2 ring-brand/25" : "border-subtle bg-shell opacity-60 grayscale hover:bg-shell"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-primary">{employee.name}</span>
                    <span className="block truncate text-xs text-muted">{employee.role}</span>
                  </span>
                  <span className="text-xs font-semibold text-muted">
                    <span>{employee.isVisible ? messages.services.visible : messages.services.hidden}</span>
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
  allEmployees: Employee[];
  services: Service[];
  allAppointments: Appointment[];
  appointments: Appointment[];
  onDeleteAppointment: (appointmentId: string) => Promise<boolean> | void;
  onMarkAppointmentPaid: (appointmentId: string) => Promise<boolean> | void;
  onRescheduleAppointment: (appointmentId: string, date: string, employeeId: string) => Promise<boolean> | void;
};

function DayCalendar({
  messages,
  focusedDate,
  employees,
  allEmployees,
  services,
  allAppointments,
  appointments,
  onDeleteAppointment,
  onMarkAppointmentPaid,
  onRescheduleAppointment
}: CalendarContentProps) {
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
                      service={service}
                      serviceName={service?.name}
                      employees={allEmployees}
                      appointments={allAppointments}
                      onDeleteAppointment={onDeleteAppointment}
                      onMarkAppointmentPaid={onMarkAppointmentPaid}
                      onRescheduleAppointment={onRescheduleAppointment}
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
  allAppointments: Appointment[];
  appointments: Appointment[];
  onDateClick: (date: string) => void;
  onDeleteAppointment: (appointmentId: string) => Promise<boolean> | void;
  onMarkAppointmentPaid: (appointmentId: string) => Promise<boolean> | void;
  onRescheduleAppointment: (appointmentId: string, date: string, employeeId: string) => Promise<boolean> | void;
};

function DateGroupedCalendar({
  messages,
  dates,
  focusedDate,
  services,
  employees,
  allAppointments,
  appointments,
  onDateClick,
  onDeleteAppointment,
  onMarkAppointmentPaid,
  onRescheduleAppointment
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
                      service={service}
                      serviceName={service?.name}
                      employeeName={employee?.name}
                      employees={employees}
                      appointments={allAppointments}
                      onDeleteAppointment={onDeleteAppointment}
                      onMarkAppointmentPaid={onMarkAppointmentPaid}
                      onRescheduleAppointment={onRescheduleAppointment}
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
  service?: Service;
  serviceName?: string;
  employeeName?: string;
  variant?: "calendar" | "dashboardRow";
  employees: Employee[];
  appointments: Appointment[];
  onDeleteAppointment: (appointmentId: string) => Promise<boolean> | void;
  onMarkAppointmentPaid: (appointmentId: string) => Promise<boolean> | void;
  onRescheduleAppointment: (appointmentId: string, date: string, employeeId: string) => Promise<boolean> | void;
};

export function AppointmentCard({
  messages,
  appointment,
  employee,
  service,
  serviceName,
  employeeName,
  variant = "calendar",
  employees,
  appointments,
  onDeleteAppointment,
  onMarkAppointmentPaid,
  onRescheduleAppointment
}: AppointmentCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(appointment.date);
  const [rescheduleEmployeeId, setRescheduleEmployeeId] = useState(appointment.employeeId);
  const [loadingAction, setLoadingAction] = useState<"paid" | "cancel" | "reschedule" | null>(null);
  const appointmentToneClass = employee ? appointmentToneClasses[employee.color] : "border-brand bg-brand-soft";
  const paymentState = getPaymentState(appointment.status);
  const availableRescheduleEmployees = service
    ? getRescheduleEmployees(service, employees, appointments, appointment, rescheduleDate)
    : [];
  const canReschedule = Boolean(service && rescheduleDate && rescheduleEmployeeId && availableRescheduleEmployees.some((item) => item.id === rescheduleEmployeeId));

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsRescheduling(false);
      setRescheduleDate(appointment.date);
      setRescheduleEmployeeId(appointment.employeeId);
    }
  }, [appointment.date, appointment.employeeId, isOpen]);

  async function deleteAppointment() {
    setLoadingAction("cancel");
    try {
      const didDelete = await onDeleteAppointment(appointment.id);

      if (didDelete !== false) {
        setIsOpen(false);
      }
    } finally {
      setLoadingAction(null);
    }
  }

  async function markAppointmentPaid() {
    setLoadingAction("paid");
    try {
      const didMarkPaid = await onMarkAppointmentPaid(appointment.id);

      if (didMarkPaid !== false) {
        setIsOpen(false);
      }
    } finally {
      setLoadingAction(null);
    }
  }

  async function rescheduleAppointment() {
    setLoadingAction("reschedule");
    try {
      const didReschedule = await onRescheduleAppointment(appointment.id, rescheduleDate, rescheduleEmployeeId);

      if (didReschedule !== false) {
        setIsOpen(false);
      }
    } finally {
      setLoadingAction(null);
    }
  }

  function updateRescheduleDate(date: string) {
    setRescheduleDate(date);

    if (!service) {
      setRescheduleEmployeeId("");
      return;
    }

    const nextEmployees = getRescheduleEmployees(service, employees, appointments, appointment, date);
    const currentEmployeeIsAvailable = nextEmployees.some((item) => item.id === rescheduleEmployeeId);
    setRescheduleEmployeeId(currentEmployeeIsAvailable ? rescheduleEmployeeId : nextEmployees[0]?.id ?? "");
  }

  const trigger = variant === "dashboardRow" ? (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="grid w-full cursor-pointer grid-cols-[1.2fr_1fr_1fr_0.9fr_0.8fr] items-center gap-3 rounded-lg border border-subtle bg-surface px-3 py-1.5 text-left text-sm shadow-sm transition-colors hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className="truncate font-semibold text-primary">{appointment.customerName}</span>
      <span className="truncate text-muted">{serviceName}</span>
      <span className="truncate text-muted">{employeeName}</span>
      <span className="whitespace-nowrap text-muted">{appointment.startTime} - {appointment.endTime}</span>
      <span>
        <Badge tone={appointment.status === "confirmed" ? "success" : appointment.status === "pending" ? "warning" : "danger"}>
          {messages.statuses[appointment.status]}
        </Badge>
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className={cx(
        "w-full cursor-pointer rounded-lg border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-brand-soft hover:shadow-md",
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
      <span className={cx(
        "mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
        paymentState === "paid" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
      )}>
        {paymentState === "paid" ? messages.calendar.paymentPaid : messages.calendar.paymentPending}
      </span>
    </button>
  );

  return (
    <>
      {trigger}

      <Modal isOpen={isOpen} className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{messages.calendar.appointmentDetails}</p>
            <h2 className="mt-2 text-2xl font-bold text-primary">{appointment.customerName}</h2>
            <p className="mt-1 text-sm text-muted">
              {[serviceName, employeeName].filter(Boolean).join(" - ")}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label={messages.actions.cancel}
            onClick={() => setIsOpen(false)}
          >
            <FiX />
          </Button>
        </div>

        <div className="mt-5 grid gap-3 rounded-xl border border-subtle bg-input p-4 text-sm">
          <AppointmentDetail icon={<FiMail />} label={messages.calendar.customerEmail} value={appointment.customerEmail || "-"} />
          <AppointmentDetail icon={<FiPhone />} label={messages.calendar.customerPhone} value={formatPhoneForDisplay(appointment.customerPhone)} />
          <AppointmentDetail icon={<FiUser />} label={messages.calendar.professional} value={employeeName || "-"} />
          <AppointmentDetail icon={<FiCalendar />} label={messages.calendar.dateAndTime} value={`${getDateLabel(appointment.date)} · ${appointment.startTime} - ${appointment.endTime}`} />
          <AppointmentDetail
            icon={<FiCheck />}
            label={messages.calendar.paymentStatus}
            value={paymentState === "paid" ? messages.calendar.paymentPaid : messages.calendar.paymentPending}
          />
        </div>

        {isRescheduling ? (
          <div className="mt-5 grid gap-4 rounded-xl border border-brand/25 bg-brand-soft p-4">
            <div>
              <h3 className="text-sm font-bold text-brand-strong">{messages.calendar.rescheduleTitle}</h3>
              <p className="mt-1 text-sm text-muted">{messages.calendar.rescheduleDescription}</p>
            </div>
            <TextField
              label={messages.calendar.newDate}
              name={`reschedule-date-${appointment.id}`}
              type="date"
              min={getTodayDateValue()}
              value={rescheduleDate}
              required
              onChange={(event) => updateRescheduleDate(event.target.value)}
            />
            <SelectField
              label={messages.calendar.chooseProfessional}
              name={`reschedule-employee-${appointment.id}`}
              value={rescheduleEmployeeId}
              disabled={availableRescheduleEmployees.length === 0}
              required
              options={
                availableRescheduleEmployees.length > 0
                  ? availableRescheduleEmployees.map((item) => ({ value: item.id, label: item.name }))
                  : [{ value: "", label: messages.calendar.noProfessionalAvailable, disabled: true }]
              }
              onChange={(event) => setRescheduleEmployeeId(event.target.value)}
            />
          </div>
        ) : null}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {isRescheduling ? (
            <>
              <Button
                variant="secondary"
                disabled={loadingAction !== null}
                className="w-full"
                onClick={() => setIsRescheduling(false)}
              >
                {messages.actions.cancel}
              </Button>
              <Button
                icon={<FiCalendar />}
                isLoading={loadingAction === "reschedule"}
                disabled={loadingAction !== null || !canReschedule}
                className="w-full"
                onClick={() => void rescheduleAppointment()}
              >
                {messages.calendar.confirmReschedule}
              </Button>
            </>
          ) : (
            <>
              {paymentState === "pending" ? (
                <Button
                  variant="secondary"
                  icon={<FiCheck />}
                  isLoading={loadingAction === "paid"}
                  disabled={loadingAction !== null}
                  className="w-full whitespace-nowrap !border-success !bg-success px-3 !text-white hover:!bg-success-soft hover:!text-success"
                  onClick={() => void markAppointmentPaid()}
                >
                  {messages.calendar.markAsPaid}
                </Button>
              ) : (
                <Button variant="secondary" icon={<FiCheck />} disabled className="w-full">
                  {messages.calendar.paymentPaid}
                </Button>
              )}
              <Button
                variant="secondary"
                icon={<FiCalendar />}
                disabled={loadingAction !== null}
                className="w-full"
                onClick={() => setIsRescheduling(true)}
              >
                {messages.calendar.reschedule}
              </Button>
              <Button
                variant="danger"
                icon={<FiTrash2 />}
                isLoading={loadingAction === "cancel"}
                disabled={loadingAction !== null}
                className="w-full sm:col-span-2"
                onClick={() => void deleteAppointment()}
              >
                {messages.calendar.cancelAppointment}
              </Button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

function AppointmentDetail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-brand-strong" aria-hidden="true">{icon}</span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
        <p className="mt-1 break-words font-semibold text-primary">{value}</p>
      </div>
    </div>
  );
}

function getRescheduleEmployees(
  service: Service,
  employees: Employee[],
  appointments: Appointment[],
  appointment: Appointment,
  date: string
) {
  const activeAppointments = appointments.filter((item) => item.id !== appointment.id);

  return employees.filter((employee) => {
    if (employee.isArchived || !employee.isVisible || !service.employeeIds.includes(employee.id)) {
      return false;
    }

    const slots = getAvailableSlotsForEmployee(
      service,
      employee,
      activeAppointments,
      new Date(`${date}T12:00:00`),
      appointment.partySize
    );

    return slots.some((slot) => (
      slot.date === date &&
      slot.startTime === appointment.startTime &&
      slot.endTime === appointment.endTime
    ));
  });
}

function getPaymentState(status: Appointment["status"]) {
  return status === "confirmed" ? "paid" : "pending";
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

function formatPhoneForDisplay(value: string) {
  const compactValue = value.replace(/\s+/g, "");

  return compactValue || "-";
}
