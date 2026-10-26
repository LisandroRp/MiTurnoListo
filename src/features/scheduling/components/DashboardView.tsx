"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiChevronDown, FiHome, FiPlusCircle } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { AppointmentCard } from "@/features/scheduling/components/CalendarView";
import { getEmployeesScheduledOnDate, getEmployeesWorkingNowOnDate } from "@/features/scheduling/components/dashboardTeamUtils";
import { DashboardActiveTeam } from "@/features/scheduling/components/DashboardActiveTeam";
import { WalkInAppointmentModal } from "@/features/scheduling/components/WalkInAppointmentModal";
import { Appointment, DashboardMetric, Employee, Service } from "@/features/scheduling/types";
import { Messages } from "@/features/scheduling/i18n/messages";
import { freePlanLimits, getFreePlanIncludedIds, isFreePlan } from "@/features/scheduling/plan-limits";
import { SubscriptionTier } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";
import { cx } from "@/components/ui/utils";

const compactHourRowHeightPx = 96;

type DashboardViewProps = {
  messages: Messages;
  metrics: DashboardMetric[];
  employees: Employee[];
  services: Service[];
  subscriptionTier: SubscriptionTier;
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
  subscriptionTier,
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
  const freeEmployeeIds = isFreePlan(subscriptionTier)
    ? getFreePlanIncludedIds(employees.filter((employee) => !employee.isArchived), freePlanLimits.activeEmployees)
    : null;
  const employeesWorkingToday = getEmployeesWorkingNowOnDate(
    employees.filter((employee) => !freeEmployeeIds || freeEmployeeIds.has(employee.id)),
    referenceDate
  );
  const employeesScheduledToday = getEmployeesScheduledOnDate(
    employees.filter((employee) => !freeEmployeeIds || freeEmployeeIds.has(employee.id)),
    referenceDate
  );
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
        icon={<FiHome />}
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

      <DashboardActiveTeam
        employees={employeesScheduledToday}
        appointments={activeTodaysAppointments}
        referenceDate={referenceDate}
        messages={messages}
        onEmployeeClick={openEmployeeInPersonnel}
      />

      <section className="grid min-w-0 flex-1 gap-6">
        <Card className="flex min-h-[28rem] h-[34rem] min-w-0 flex-col overflow-hidden p-0">
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

      </section>

      <WalkInAppointmentModal
        businessId={businessId}
        employees={employees}
        isOpen={isWalkInModalOpen}
        messages={messages}
        services={services}
        subscriptionTier={subscriptionTier}
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
  const currentHourRowRef = useRef<HTMLDivElement | null>(null);
  const hourContentRefs = useRef(new Map<number, HTMLDivElement>());
  const didInitialScrollRef = useRef(false);
  const [expandedHours, setExpandedHours] = useState<Set<number>>(new Set());
  const [expandedHourHeights, setExpandedHourHeights] = useState<Record<number, number>>({});
  const currentTimeDetails = useMemo(
    () => currentTimePosition !== null ? getCurrentTimeDetails() : null,
    [currentTimePosition]
  );
  const measureHourRows = useCallback(() => {
    const nextHeights: Record<number, number> = {};

    hourContentRefs.current.forEach((node, hour) => {
      nextHeights[hour] = Math.max(compactHourRowHeightPx, node.scrollHeight);
    });

    setExpandedHourHeights((currentHeights) => {
      const currentKeys = Object.keys(currentHeights);
      const nextKeys = Object.keys(nextHeights);
      const hasSameHeights = currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => currentHeights[Number(key)] === nextHeights[Number(key)]);

      return hasSameHeights ? currentHeights : nextHeights;
    });
  }, []);

  useEffect(() => {
    const frameId = requestAnimationFrame(measureHourRows);

    if (typeof ResizeObserver === "undefined") {
      return () => cancelAnimationFrame(frameId);
    }

    const observer = new ResizeObserver(measureHourRows);
    hourContentRefs.current.forEach((node) => observer.observe(node));

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [appointments, employees, measureHourRows, services]);

  useEffect(() => {
    if (didInitialScrollRef.current || !currentTimeDetails || !scrollContainerRef.current || !currentHourRowRef.current) {
      return;
    }

    const container = scrollContainerRef.current;
    const lineOffset = currentHourRowRef.current.offsetTop + currentTimeDetails.minuteOffset;
    container.scrollTop = Math.max(lineOffset - container.clientHeight / 2, 0);
    didInitialScrollRef.current = true;
  }, [currentTimeDetails]);

  function toggleExpandedHour(hour: number) {
    setExpandedHours((current) => {
      const next = new Set(current);

      if (next.has(hour)) {
        next.delete(hour);
      } else {
        next.add(hour);
      }

      return next;
    });
  }

  function setHourContentRef(hour: number, node: HTMLDivElement | null) {
    if (node) {
      hourContentRefs.current.set(hour, node);
      return;
    }

    hourContentRefs.current.delete(hour);
  }

  return (
    <div ref={scrollContainerRef} className="overflow-auto [overflow-anchor:none]">
      <div className="min-w-[760px]">
        <div className="sticky top-0 z-40 grid grid-cols-[4.5rem_1.2fr_1fr_1fr_0.9fr_0.8fr] border-b border-subtle bg-surface-strong px-4 py-3 text-xs font-bold uppercase tracking-[0.04em] text-muted">
          <span>{messages.home.time}</span>
          <span>{messages.home.customer}</span>
          <span>{messages.home.service}</span>
          <span>{messages.home.employee}</span>
          <span>{messages.home.time}</span>
          <span>{messages.home.status}</span>
        </div>
        <div className="relative">
          {Array.from({ length: 24 }, (_, hour) => {
            const hourAppointments = appointments.filter((appointment) => Number(appointment.startTime.slice(0, 2)) === hour);
            const isExpanded = expandedHours.has(hour);
            const canExpand = hourAppointments.length > 1;
            const isCurrentHour = currentTimeDetails?.hour === hour;
            const rowMaxHeight = isExpanded ? expandedHourHeights[hour] ?? compactHourRowHeightPx : compactHourRowHeightPx;

            return (
              <div
                key={hour}
                ref={isCurrentHour ? currentHourRowRef : null}
                className="relative"
              >
                <div
                  className={cx(
                    "grid min-h-24 grid-cols-[4.5rem_1fr] overflow-hidden border-subtle transition-[max-height] duration-500 ease-in-out",
                    hour === 23 ? "border-b-0" : "border-b"
                  )}
                  style={{ maxHeight: `${rowMaxHeight}px` }}
                >
                  <div className="bg-input px-4 py-3 text-sm font-semibold text-muted">
                    <span>{String(hour).padStart(2, "0")}:00</span>
                    {canExpand ? (
                      <button
                        type="button"
                        className="mt-2 grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-subtle bg-surface text-muted shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-brand hover:bg-brand-soft hover:text-brand-strong hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        aria-label={isExpanded ? "Ocultar turnos de esta hora" : "Mostrar turnos de esta hora"}
                        title={isExpanded ? "Ocultar turnos" : "Mostrar turnos"}
                        onClick={() => toggleExpandedHour(hour)}
                      >
                        <FiChevronDown className={cx("transition-transform", isExpanded ? "rotate-180" : "")} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  <div ref={(node) => setHourContentRef(hour, node)} className="grid content-start gap-1.5 px-4 py-2">
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
                {canExpand ? (
                  <div
                    aria-hidden="true"
                    className={cx(
                      "pointer-events-none absolute bottom-px left-[4.5rem] right-0 z-10 h-8 bg-linear-to-t from-surface via-surface/60 via-35% to-surface/0 transition-opacity duration-300 motion-reduce:transition-none",
                      isExpanded ? "opacity-0" : "opacity-100"
                    )}
                  />
                ) : null}
                {isCurrentHour && currentTimeDetails ? (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-30 flex w-full items-center"
                    style={{ top: `${currentTimeDetails.minuteOffset}px` }}
                  >
                    <span className="h-2 w-2 rounded-full bg-danger" />
                    <span className="h-px flex-1 bg-danger" />
                    <span className="absolute bottom-full left-4 inline-flex w-fit rounded-md danger bg-white px-2 py-0.5 text-xs font-bold leading-5 text-danger shadow-sm">
                      {currentTimeDetails.label}
                    </span>
                  </div>
                ) : null}
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

function getCurrentTimeDetails() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const label = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return {
    hour,
    label,
    minuteOffset: (minute / 60) * compactHourRowHeightPx
  };
}

function getTodayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
