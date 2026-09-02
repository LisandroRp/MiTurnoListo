"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiPlusCircle, FiUsers } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { AppointmentCard } from "@/features/scheduling/components/CalendarView";
import { getDayKeyForDate, getEmployeesWorkingNowOnDate } from "@/features/scheduling/components/dashboardTeamUtils";
import { employeeColorClasses } from "@/features/scheduling/components/employeeColors";
import { WalkInAppointmentModal } from "@/features/scheduling/components/WalkInAppointmentModal";
import { Appointment, DashboardMetric, Employee, Service } from "@/features/scheduling/types";
import { Messages } from "@/features/scheduling/i18n/messages";
import { formatCurrency } from "@/features/scheduling/utils/format";
import { cx } from "@/components/ui/utils";

type DashboardViewProps = {
  messages: Messages;
  metrics: DashboardMetric[];
  employees: Employee[];
  services: Service[];
  appointments: Appointment[];
  businessId: string | null;
  referenceDate: string;
  onCreateAppointment: (appointment: Appointment) => Promise<boolean> | void;
  onDeleteAppointment: (appointmentId: string, cancellationReason: string) => Promise<boolean> | void;
  onMarkAppointmentNoShow: (appointmentId: string) => Promise<boolean> | void;
  onMarkAppointmentPaid: (appointmentId: string) => Promise<boolean> | void;
  onRescheduleAppointment: (appointmentId: string, date: string, employeeId: string, startTime: string, endTime: string) => Promise<boolean> | void;
};

export function DashboardView({
  messages,
  metrics,
  employees,
  services,
  appointments,
  businessId,
  referenceDate,
  onCreateAppointment,
  onDeleteAppointment,
  onMarkAppointmentNoShow,
  onMarkAppointmentPaid,
  onRescheduleAppointment
}: DashboardViewProps) {
  const router = useRouter();
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [isWalkInConfirmationOpen, setIsWalkInConfirmationOpen] = useState(false);
  const activeServiceIds = new Set(services.filter((service) => !service.isArchived).map((service) => service.id));
  const todaysAppointments = appointments.filter((appointment) => appointment.date === referenceDate && activeServiceIds.has(appointment.serviceId));
  const activeTodaysAppointments = todaysAppointments.filter((appointment) => appointment.appointmentStatus !== "cancelled");
  const todayKey = getDayKeyForDate(referenceDate);
  const employeesWorkingToday = getEmployeesWorkingNowOnDate(employees, referenceDate);
  const dayAppointments = todaysAppointments
    .slice()
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
  const currentTimePosition = getCurrentTimePosition(referenceDate);
  const openEmployeeInPersonnel = (employee: Employee) => {
    router.push(`/personal?search=${encodeURIComponent(employee.name)}`);
  };
  const openWalkInFlow = () => {
    if (employeesWorkingToday.length === 0) {
      setIsWalkInConfirmationOpen(true);
      return;
    }

    setIsWalkInModalOpen(true);
  };
  const confirmWalkInWithoutActiveTeam = () => {
    setIsWalkInConfirmationOpen(false);
    setIsWalkInModalOpen(true);
  };

  return (
    <div className="flex min-h-[calc(100vh-2.5rem)] flex-col gap-6">
      <SectionHeader
        eyebrow={messages.home.eyebrow}
        title={messages.home.title}
        description={messages.home.description}
      />

      <div className="grid gap-3">
        <p className="text-xs font-semibold text-muted">{messages.metrics.contexts.monthComparison}</p>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.id} className="flex flex-col justify-between">
              <div className="flex flex-wrap gap-2 flex-row justify-between">
              <p className="text-sm text-muted">{messages.metrics[metric.labelKey]}</p>
                              {metric.trendFormat !== "current" ? (
                  <Badge tone={metric.trendTone}>{formatMetricTrend(metric, messages)}</Badge>
                ) : null}
                </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-3xl font-bold text-primary">{metric.value}</p>
              </div>
            </Card>
          ))}
        </section>
      </div>

      <section className="grid flex-1 items-stretch gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="flex min-h-[28rem] h-[34rem] flex-col overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-subtle p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-primary">{messages.home.todayAgenda}</h2>
            <Button size="sm" icon={<FiPlusCircle />} onClick={openWalkInFlow}>
              {messages.walkInAppointment.action}
            </Button>
          </div>
          <DayAgenda
            appointments={dayAppointments}
            currentTimePosition={currentTimePosition}
            employees={employees}
            messages={messages}
            services={services}
            onDeleteAppointment={onDeleteAppointment}
            onMarkAppointmentNoShow={onMarkAppointmentNoShow}
            onMarkAppointmentPaid={onMarkAppointmentPaid}
            onRescheduleAppointment={onRescheduleAppointment}
          />
        </Card>

        <Card className="flex min-h-[28rem] h-[34rem] flex-col">
          <h2 className="text-lg font-bold text-primary">{messages.home.teamToday}</h2>
          {employeesWorkingToday.length > 0 ? (
            <div className="mt-4 grid content-start gap-3 overflow-auto py-2">
              {employeesWorkingToday.map((employee) => {
              const employeeSchedule = employee.schedule[todayKey] ?? [];
              const employeeAppointments = activeTodaysAppointments.filter((appointment) => appointment.employeeId === employee.id);

              return (
                <button
                  key={employee.id}
                  type="button"
                  className="grid cursor-pointer gap-3 rounded-lg border border-subtle bg-input p-3 text-left transition duration-200 hover:-translate-y-1 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-focus"
                  onClick={() => openEmployeeInPersonnel(employee)}
                >
                  <div className="flex items-center gap-3">
                    <span className={cx("grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-on-brand", employeeColorClasses[employee.color])}>
                      {employee.initials}
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate font-semibold text-primary">{employee.name}</span>
                      <span className="text-sm leading-tight text-muted">{employee.role}</span>
                    </span>
                  </div>

                  <div className="grid text-sm leading-tight">
                    <DashboardTeamFact
                      label={messages.home.todayHours}
                      value={formatTodaySchedule(employeeSchedule, messages)}
                    />
                    <DashboardTeamFact
                      label={messages.home.todayAppointments}
                      value={formatAppointmentCount(employeeAppointments.length, messages)}
                    />
                  </div>
                </button>
              );
              })}
            </div>
          ) : (
            <div className="grid flex-1 place-items-center py-8 text-center">
              <div className="grid justify-items-center gap-3">
                <FiUsers className="text-5xl text-muted opacity-35" aria-hidden="true" />
                <p className="max-w-56 text-sm font-semibold text-muted">{messages.home.noActiveTeam}</p>
              </div>
            </div>
          )}
        </Card>
      </section>

      <WalkInAppointmentModal
        businessId={businessId}
        employees={employees}
        isOpen={isWalkInModalOpen}
        messages={messages}
        services={services}
        onClose={() => setIsWalkInModalOpen(false)}
        onCreateAppointment={onCreateAppointment}
      />

      <Modal isOpen={isWalkInConfirmationOpen}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{messages.walkInAppointment.eyebrow}</p>
            <h2 className="mt-1 text-2xl font-bold text-primary">{messages.walkInAppointment.noActiveTeamTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{messages.walkInAppointment.noActiveTeamDescription}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => setIsWalkInConfirmationOpen(false)}>
              {messages.actions.cancel}
            </Button>
            <Button icon={<FiPlusCircle />} onClick={confirmWalkInWithoutActiveTeam}>
              {messages.walkInAppointment.createAnywayAction}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function DashboardTeamFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-1 leading-tight">
      <span className="text-xs font-bold uppercase leading-tight text-muted">{label}</span>
      <span className="text-right font-semibold text-primary">{value}</span>
    </div>
  );
}

function formatTodaySchedule(ranges: Employee["schedule"][string], messages: Messages) {
  if (ranges.length === 0) {
    return messages.home.noTodayHours;
  }

  return ranges.map((range) => `${range.start} - ${range.end}`).join(", ");
}

function formatAppointmentCount(count: number, messages: Messages) {
  return `${count} ${count === 1 ? messages.calendar.appointment : messages.calendar.appointments}`;
}

function DayAgenda({
  appointments,
  currentTimePosition,
  employees,
  messages,
  services,
  onDeleteAppointment,
  onMarkAppointmentNoShow,
  onMarkAppointmentPaid,
  onRescheduleAppointment
}: {
  appointments: Appointment[];
  currentTimePosition: number | null;
  employees: Employee[];
  messages: Messages;
  services: Service[];
  onDeleteAppointment: (appointmentId: string, cancellationReason: string) => Promise<boolean> | void;
  onMarkAppointmentNoShow: (appointmentId: string) => Promise<boolean> | void;
  onMarkAppointmentPaid: (appointmentId: string) => Promise<boolean> | void;
  onRescheduleAppointment: (appointmentId: string, date: string, employeeId: string, startTime: string, endTime: string) => Promise<boolean> | void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const currentTimeLabel = currentTimePosition !== null ? getCurrentTimeLabel() : "";

  useEffect(() => {
    if (currentTimePosition === null || !scrollContainerRef.current) {
      return;
    }

    const container = scrollContainerRef.current;
    const lineOffset = container.scrollHeight * (currentTimePosition / 100);
    container.scrollTop = Math.max(lineOffset - container.clientHeight / 2, 0);
  }, [currentTimePosition]);

  return (
    <div ref={scrollContainerRef} className="overflow-auto">
      <div className="min-w-[760px]">
        <div className="sticky top-0 z-10 grid grid-cols-[4.5rem_1.2fr_1fr_1fr_0.9fr_0.8fr] border-b border-subtle bg-surface-strong px-4 py-3 text-xs font-bold uppercase tracking-[0.04em] text-muted">
          <span>{messages.home.time}</span>
          <span>{messages.home.customer}</span>
          <span>{messages.home.service}</span>
          <span>{messages.home.employee}</span>
          <span>{messages.home.time}</span>
          <span>{messages.home.status}</span>
        </div>
        <div className="relative h-[144rem]">
          {currentTimePosition !== null ? (
            <div
              className="pointer-events-none absolute left-0 right-0 flex w-full items-center pt-5"
              style={{ top: `${currentTimePosition}%` }}
            >
              <span className="h-2 w-2 rounded-full bg-danger" />
              <span className="h-px flex-1 bg-danger" />
              <span className="absolute left-4 bottom-1 text-xs font-bold text-danger">
                {currentTimeLabel}
              </span>
            </div>
          ) : null}
          {Array.from({ length: 24 }, (_, hour) => {
            const hourAppointments = appointments.filter((appointment) => Number(appointment.startTime.slice(0, 2)) === hour);

            return (
              <div key={hour} className="grid h-24 grid-cols-[4.5rem_1fr] border-b border-subtle last:border-b-0">
                <div className="bg-input px-4 py-3 text-sm font-semibold text-muted">
                  {String(hour).padStart(2, "0")}:00
                </div>
                <div className="grid max-h-24 content-start gap-1.5 overflow-y-auto px-4 py-2">
                  {hourAppointments.map((appointment) => {
                    const service = services.find((item) => item.id === appointment.serviceId);
                    const employee = employees.find((item) => item.id === appointment.employeeId);

                    return (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        appointments={appointments}
                        employee={employee}
                        employeeName={employee?.name ?? "-"}
                        employees={employees}
                        messages={messages}
                        service={service}
                        serviceName={service?.name ?? "-"}
                        variant="dashboardRow"
                        onDeleteAppointment={onDeleteAppointment}
                        onMarkAppointmentNoShow={onMarkAppointmentNoShow}
                        onMarkAppointmentPaid={onMarkAppointmentPaid}
                        onRescheduleAppointment={onRescheduleAppointment}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getCurrentTimePosition(referenceDate: string) {
  if (referenceDate !== getTodayDateValue()) {
    return null;
  }

  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  return (minutes / (24 * 60)) * 100;
}

function getTodayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCurrentTimeLabel() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function formatMetricTrend(metric: DashboardMetric, messages: Messages) {
  if (metric.trendFormat === "current" || metric.trendValue === null) {
    return messages.metrics.current;
  }

  if (metric.trendValue === 0) {
    return messages.metrics.noChange;
  }

  const prefix = metric.trendValue > 0 ? "+" : "-";
  const absoluteValue = Math.abs(metric.trendValue);

  if (metric.trendFormat === "currency") {
    return `${prefix}${formatCurrency(absoluteValue)}`;
  }

  return `${prefix}${absoluteValue}`;
}
