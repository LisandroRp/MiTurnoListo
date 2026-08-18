"use client";

import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { AppointmentCard } from "@/features/scheduling/components/CalendarView";
import { employeeColorClasses } from "@/features/scheduling/components/employeeColors";
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
  referenceDate: string;
  onDeleteAppointment: (appointmentId: string) => Promise<boolean> | void;
  onMarkAppointmentPaid: (appointmentId: string) => Promise<boolean> | void;
  onRescheduleAppointment: (appointmentId: string, date: string, employeeId: string) => Promise<boolean> | void;
};

export function DashboardView({
  messages,
  metrics,
  employees,
  services,
  appointments,
  referenceDate,
  onDeleteAppointment,
  onMarkAppointmentPaid,
  onRescheduleAppointment
}: DashboardViewProps) {
  const activeServiceIds = new Set(services.filter((service) => !service.isArchived).map((service) => service.id));
  const todaysAppointments = appointments.filter((appointment) => appointment.date === referenceDate && activeServiceIds.has(appointment.serviceId));
  const activeTodaysAppointments = todaysAppointments.filter((appointment) => appointment.status !== "cancelled");
  const todaysAppointmentEmployeeIds = new Set(activeTodaysAppointments.map((appointment) => appointment.employeeId));
  const todayKey = getDayKeyForDate(referenceDate);
  const employeesWorkingToday = employees.filter((employee) => (
    !employee.isArchived &&
    ((employee.schedule[todayKey] ?? []).length > 0 || todaysAppointmentEmployeeIds.has(employee.id))
  ));
  const dayAppointments = todaysAppointments
    .slice()
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
  const currentTimePosition = getCurrentTimePosition(referenceDate);

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
        <Card className="flex min-h-[28rem] flex-col overflow-hidden p-0">
          <div className="border-b border-subtle p-5">
            <h2 className="text-lg font-bold text-primary">{messages.home.todayAgenda}</h2>
          </div>
          <DayAgenda
            appointments={dayAppointments}
            currentTimePosition={currentTimePosition}
            employees={employees}
            messages={messages}
            services={services}
            onDeleteAppointment={onDeleteAppointment}
            onMarkAppointmentPaid={onMarkAppointmentPaid}
            onRescheduleAppointment={onRescheduleAppointment}
          />
        </Card>

        <Card className="flex min-h-[28rem] flex-col">
          <h2 className="text-lg font-bold text-primary">{messages.home.teamToday}</h2>
          <div className="mt-4 grid content-start gap-3">
            {employeesWorkingToday.map((employee) => (
              <div key={employee.id} className="flex items-center gap-3 rounded-lg border border-subtle bg-input p-3">
                <span className={cx("grid h-10 w-10 place-items-center rounded-full text-sm font-bold text-on-brand", employeeColorClasses[employee.color])}>
                  {employee.initials}
                </span>
                <span>
                  <span className="block font-semibold text-primary">{employee.name}</span>
                  <span className="text-sm text-muted">{employee.role}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function DayAgenda({
  appointments,
  currentTimePosition,
  employees,
  messages,
  services,
  onDeleteAppointment,
  onMarkAppointmentPaid,
  onRescheduleAppointment
}: {
  appointments: Appointment[];
  currentTimePosition: number | null;
  employees: Employee[];
  messages: Messages;
  services: Service[];
  onDeleteAppointment: (appointmentId: string) => Promise<boolean> | void;
  onMarkAppointmentPaid: (appointmentId: string) => Promise<boolean> | void;
  onRescheduleAppointment: (appointmentId: string, date: string, employeeId: string) => Promise<boolean> | void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (currentTimePosition === null || !scrollContainerRef.current) {
      return;
    }

    const container = scrollContainerRef.current;
    const lineOffset = container.scrollHeight * (currentTimePosition / 100);
    container.scrollTop = Math.max(lineOffset - container.clientHeight / 2, 0);
  }, [currentTimePosition]);

  return (
    <div ref={scrollContainerRef} className="h-[34rem] overflow-auto">
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
              className="pointer-events-none absolute left-0 right-0 flex w-full items-center"
              style={{ top: `${currentTimePosition}%` }}
            >
              <span className="h-2 w-2 rounded-full bg-danger" />
              <span className="h-px flex-1 bg-danger" />
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
  return new Date().toISOString().slice(0, 10);
}

function getDayKeyForDate(date: string) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const dayByWeekday: Record<number, keyof Employee["schedule"]> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday"
  };

  return dayByWeekday[weekday] ?? "monday";
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
