import { ReactNode, useState } from "react";
import { FiActivity, FiBarChart2, FiClock, FiDollarSign, FiTrendingUp, FiUsers } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { PremiumFeatureCard } from "@/components/composed/PremiumFeatureCard";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { employeeColorClasses } from "@/features/scheduling/components/employeeColors";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Appointment, AppointmentStatus, Employee, Service } from "@/features/scheduling/types";
import { cx } from "@/components/ui/utils";

type StatisticsViewProps = {
  appointments: Appointment[];
  employees: Employee[];
  isLocked?: boolean;
  services: Service[];
  messages: Messages;
  referenceDate: string;
};

type PeriodId = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "allTime";

type StatCard = {
  id: string;
  label: string;
  value: string;
  helper: string;
  tone: "brand" | "success" | "warning" | "danger" | "neutral";
  icon: ReactNode;
};

const statusToneMap: Record<AppointmentStatus, "success" | "warning" | "danger"> = {
  confirmed: "success",
  pending: "warning",
  cancelled: "danger"
};

const periodIds: PeriodId[] = ["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "allTime"];

export function StatisticsView({ appointments, employees, isLocked = false, services, messages, referenceDate }: StatisticsViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodId>("thisMonth");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);
  const filteredAppointments = appointments.filter((appointment) => (
    matchesPeriod(appointment.date, selectedPeriod, referenceDate) &&
    (selectedEmployeeId === "all" || appointment.employeeId === selectedEmployeeId)
  ));
  const latestAppointments = filteredAppointments
    .slice()
    .sort((left, right) => `${right.date}${right.startTime}`.localeCompare(`${left.date}${left.startTime}`));
  const confirmedAppointments = filteredAppointments.filter((appointment) => appointment.status === "confirmed");
  const pendingAppointments = filteredAppointments.filter((appointment) => appointment.status === "pending");
  const cancelledAppointments = filteredAppointments.filter((appointment) => appointment.status === "cancelled");
  const estimatedRevenue = filteredAppointments
    .filter((appointment) => appointment.status !== "cancelled")
    .reduce((total, appointment) => total + appointment.revenue, 0);
  const capturedRevenue = confirmedAppointments.reduce((total, appointment) => total + appointment.revenue, 0);
  const pendingRevenue = pendingAppointments.reduce((total, appointment) => total + appointment.revenue, 0);
  const averageTicket = filteredAppointments.length > 0 ? estimatedRevenue / filteredAppointments.length : 0;
  const totalPeople = filteredAppointments.reduce((total, appointment) => total + appointment.partySize, 0);
  const confirmedShare = filteredAppointments.length > 0 ? (confirmedAppointments.length / filteredAppointments.length) * 100 : 0;

  const cards: StatCard[] = [
    {
      id: "total",
      label: messages.statistics.cards.totalAppointments,
      value: String(filteredAppointments.length),
      helper: `${totalPeople} ${messages.statistics.people}`,
      tone: "brand",
      icon: <FiActivity />
    },
    {
      id: "estimated",
      label: messages.statistics.cards.estimatedRevenue,
      value: formatCurrency(estimatedRevenue),
      helper: `${formatCurrency(capturedRevenue)} ${messages.statistics.capturedRevenue.toLowerCase()}`,
      tone: "success",
      icon: <FiDollarSign />
    },
    {
      id: "pending",
      label: messages.statistics.cards.pendingRevenue,
      value: formatCurrency(pendingRevenue),
      helper: `${pendingAppointments.length} ${messages.statistics.pendingAppointments.toLowerCase()}`,
      tone: "warning",
      icon: <FiClock />
    },
    {
      id: "avg",
      label: messages.statistics.cards.averageTicket,
      value: formatCurrency(averageTicket),
      helper: messages.statistics.revenuePerBooking,
      tone: "neutral",
      icon: <FiTrendingUp />
    },
    {
      id: "confirmed",
      label: messages.statistics.cards.confirmedAppointments,
      value: String(confirmedAppointments.length),
      helper: `${Math.round(confirmedShare)}% ${messages.statistics.confirmedShare.toLowerCase()}`,
      tone: "success",
      icon: <FiBarChart2 />
    },
    {
      id: "cancelled",
      label: messages.statistics.cards.cancellations,
      value: String(cancelledAppointments.length),
      helper: filteredAppointments.length > 0 ? `${Math.round((cancelledAppointments.length / filteredAppointments.length) * 100)}%` : "0%",
      tone: "danger",
      icon: <FiUsers />
    }
  ];

  const topServices = services
    .map((service) => {
      const serviceAppointments = filteredAppointments.filter((appointment) => appointment.serviceId === service.id);
      const bookings = serviceAppointments.length;
      const revenue = serviceAppointments
        .filter((appointment) => appointment.status !== "cancelled")
        .reduce((total, appointment) => total + appointment.revenue, 0);

      return {
        id: service.id,
        name: service.name,
        bookings,
        revenue
      };
    })
    .filter((service) => service.bookings > 0)
    .sort((left, right) => right.bookings - left.bookings || right.revenue - left.revenue);

  const hourlyDistribution = buildHourlyDistribution(filteredAppointments);
  const employeePerformance = employees
    .map((employee) => {
      const employeeAppointments = filteredAppointments.filter((appointment) => appointment.employeeId === employee.id);
      const bookings = employeeAppointments.length;
      const revenue = employeeAppointments
        .filter((appointment) => appointment.status !== "cancelled")
        .reduce((total, appointment) => total + appointment.revenue, 0);

      return {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        color: employee.color,
        initials: employee.initials,
        bookings,
        revenue
      };
    })
    .filter((employee) => employee.bookings > 0)
    .sort((left, right) => right.bookings - left.bookings || right.revenue - left.revenue);

  const statusRows = [
    {
      id: "confirmed",
      label: messages.statuses.confirmed,
      value: confirmedAppointments.length,
      percentage: getPercentage(confirmedAppointments.length, filteredAppointments.length),
      tone: "success" as const
    },
    {
      id: "pending",
      label: messages.statuses.pending,
      value: pendingAppointments.length,
      percentage: getPercentage(pendingAppointments.length, filteredAppointments.length),
      tone: "warning" as const
    },
    {
      id: "cancelled",
      label: messages.statuses.cancelled,
      value: cancelledAppointments.length,
      percentage: getPercentage(cancelledAppointments.length, filteredAppointments.length),
      tone: "danger" as const
    }
  ];

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow={messages.statistics.eyebrow}
        title={messages.statistics.title}
        description={messages.statistics.description}
      />

      <div className="relative">
        {isLocked ? (
          <div className="pointer-events-none fixed inset-y-0 left-0 right-0 z-10 grid place-items-center px-4 lg:left-72">
            <div className="pointer-events-auto w-full max-w-lg">
              <PremiumFeatureCard
                badge={messages.statistics.lockedBadge}
                title={messages.statistics.lockedTitle}
                description={messages.statistics.lockedDescription}
                actionLabel={messages.statistics.lockedAction}
              />
            </div>
          </div>
        ) : null}
        <div className={cx("grid gap-6", isLocked ? "pointer-events-none select-none blur-sm" : "")}>
      <Card className="bg-brand-soft">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-strong">{messages.statistics.analysisPeriod}</p>
            <h2 className="mt-1 text-lg font-bold text-primary">{messages.statistics.periods[selectedPeriod]}</h2>
            <p className="mt-1 text-sm text-muted">
              {selectedEmployee ? selectedEmployee.name : messages.statistics.allEmployees}
            </p>
            <div className="mt-3">
              <Badge tone="brand">
                {filteredAppointments.length} {messages.statistics.bookings}
              </Badge>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[28rem]">
            <SelectField
              label={messages.statistics.periodFilter}
              value={selectedPeriod}
              onChange={(event) => setSelectedPeriod(event.target.value as PeriodId)}
              options={periodIds.map((periodId) => ({
                value: periodId,
                label: messages.statistics.periods[periodId]
              }))}
            />
            <SelectField
              label={messages.statistics.employeeFilter}
              value={selectedEmployeeId}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
              options={[
                { value: "all", label: messages.statistics.allEmployees },
                ...employees.map((employee) => ({
                  value: employee.id,
                  label: employee.name
                }))
              ]}
            />
          </div>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.id} className="transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">{card.label}</p>
                <p className="mt-3 text-3xl font-bold text-primary">{card.value}</p>
                <p className="mt-2 text-sm text-muted">{card.helper}</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-input text-lg text-primary">
                {card.icon}
              </span>
            </div>
            <div className="mt-4">
              <Badge tone={card.tone}>{card.label}</Badge>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <AnalyticsPanel title={messages.statistics.panels.topServices} description={messages.statistics.panels.topServicesHint}>
          {topServices.length > 0 ? (
            <div className="grid gap-4">
              {topServices.map((service) => (
                <MetricBar
                  key={service.id}
                  label={service.name}
                  value={`${service.bookings} ${messages.statistics.bookings}`}
                  helper={formatCurrency(service.revenue)}
                  progress={getPercentage(service.bookings, topServices[0]?.bookings ?? 0)}
                  toneClass="bg-brand"
                />
              ))}
            </div>
          ) : (
            <EmptyState message={messages.statistics.empty} />
          )}
        </AnalyticsPanel>

        <AnalyticsPanel
          title={messages.statistics.panels.hourlyDistribution}
          description={messages.statistics.panels.hourlyDistributionHint}
        >
          {hourlyDistribution.length > 0 ? (
            <div className="grid gap-4">
              {hourlyDistribution.map((slot) => (
                <MetricBar
                  key={slot.label}
                  label={slot.label}
                  value={`${slot.count} ${messages.statistics.bookings}`}
                  helper={`${slot.people} ${messages.statistics.people}`}
                  progress={getPercentage(slot.count, hourlyDistribution[0]?.count ?? 0)}
                  toneClass="bg-employee-blue"
                />
              ))}
            </div>
          ) : (
            <EmptyState message={messages.statistics.empty} />
          )}
        </AnalyticsPanel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <AnalyticsPanel
          title={messages.statistics.panels.statusBreakdown}
          description={messages.statistics.panels.statusBreakdownHint}
        >
          {filteredAppointments.length > 0 ? (
            <div className="grid gap-4">
              {statusRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-subtle bg-input p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-primary">{row.label}</span>
                    <Badge tone={row.tone}>{row.value}</Badge>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-strong">
                    <div
                      className={cx(
                        "h-full rounded-full transition-all",
                        row.tone === "success"
                          ? "bg-success"
                          : row.tone === "warning"
                            ? "bg-warning"
                            : "bg-danger"
                      )}
                      style={{ width: `${row.percentage}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted">{Math.round(row.percentage)}%</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message={messages.statistics.empty} />
          )}
        </AnalyticsPanel>

        <AnalyticsPanel
          title={messages.statistics.panels.employeePerformance}
          description={messages.statistics.panels.employeePerformanceHint}
        >
          {employeePerformance.length > 0 ? (
            <div className="grid gap-3">
              {employeePerformance.map((employee) => (
                <div key={employee.id} className="rounded-xl border border-subtle bg-input p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={cx(
                        "grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-on-brand",
                        employeeColorClasses[employee.color]
                      )}
                    >
                      {employee.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-primary">{employee.name}</p>
                          <p className="text-sm text-muted">{employee.role}</p>
                        </div>
                        <Badge tone="brand">{employee.bookings} {messages.statistics.bookings}</Badge>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <MiniStat label={messages.statistics.cards.estimatedRevenue} value={formatCurrency(employee.revenue)} />
                        <MiniStat
                          label={messages.statistics.cards.averageTicket}
                          value={formatCurrency(employee.bookings > 0 ? employee.revenue / employee.bookings : 0)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message={messages.statistics.empty} />
          )}
        </AnalyticsPanel>
      </section>

      <AnalyticsPanel
        title={messages.statistics.panels.latestAppointments}
        description={messages.statistics.panels.latestAppointmentsHint}
      >
        {latestAppointments.length > 0 ? (
          <>
            <div className="grid gap-3 sm:hidden">
              {latestAppointments.map((appointment) => {
                const service = services.find((item) => item.id === appointment.serviceId);
                const employee = employees.find((item) => item.id === appointment.employeeId);

                return (
                  <div key={appointment.id} className="rounded-xl border border-subtle bg-input p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{appointment.customerName}</p>
                        <p className="mt-1 text-sm text-muted">{service?.name ?? "-"}</p>
                      </div>
                      <Badge tone={statusToneMap[appointment.status]}>{messages.statuses[appointment.status]}</Badge>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <MiniStat label={messages.home.employee} value={employee?.name ?? "-"} />
                      <MiniStat
                        label={messages.home.time}
                        value={`${appointment.date} · ${appointment.startTime} - ${appointment.endTime}`}
                      />
                      <MiniStat
                        label={messages.statistics.cards.estimatedRevenue}
                        value={formatCurrency(appointment.revenue)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="bg-surface-strong text-left text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{messages.home.customer}</th>
                    <th className="px-4 py-3 font-semibold">{messages.home.service}</th>
                    <th className="px-4 py-3 font-semibold">{messages.home.employee}</th>
                    <th className="px-4 py-3 font-semibold">{messages.home.time}</th>
                    <th className="px-4 py-3 font-semibold">{messages.home.status}</th>
                    <th className="px-4 py-3 font-semibold">{messages.statistics.cards.estimatedRevenue}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {latestAppointments.map((appointment) => {
                    const service = services.find((item) => item.id === appointment.serviceId);
                    const employee = employees.find((item) => item.id === appointment.employeeId);

                    return (
                      <tr key={appointment.id}>
                        <td className="px-4 py-4 font-semibold text-primary">{appointment.customerName}</td>
                        <td className="px-4 py-4 text-muted">{service?.name}</td>
                        <td className="px-4 py-4 text-muted">{employee?.name}</td>
                        <td className="px-4 py-4 text-muted">
                          {appointment.date} · {appointment.startTime} - {appointment.endTime}
                        </td>
                        <td className="px-4 py-4">
                          <Badge tone={statusToneMap[appointment.status]}>{messages.statuses[appointment.status]}</Badge>
                        </td>
                        <td className="px-4 py-4 text-muted">{formatCurrency(appointment.revenue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState message={messages.statistics.empty} />
        )}
      </AnalyticsPanel>
        </div>
      </div>
    </div>
  );
}

function AnalyticsPanel({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="border-b border-subtle pb-4">
        <h2 className="text-lg font-bold text-primary">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function MetricBar({
  label,
  value,
  helper,
  progress,
  toneClass
}: {
  label: string;
  value: string;
  helper: string;
  progress: number;
  toneClass: string;
}) {
  return (
    <div className="rounded-xl border border-subtle bg-input p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-primary">{label}</p>
          <p className="mt-1 text-sm text-muted">{helper}</p>
        </div>
        <span className="text-sm font-semibold text-primary sm:text-right">{value}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-strong">
        <div className={cx("h-full rounded-full transition-all", toneClass)} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-subtle bg-surface px-3 py-2">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="mt-1 text-sm font-bold text-primary">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted">{message}</p>;
}

function buildHourlyDistribution(appointments: Appointment[]) {
  const buckets = [
    { label: "08:00 - 11:59", start: 8, end: 11, count: 0, people: 0 },
    { label: "12:00 - 14:59", start: 12, end: 14, count: 0, people: 0 },
    { label: "15:00 - 17:59", start: 15, end: 17, count: 0, people: 0 },
    { label: "18:00 - 21:00", start: 18, end: 21, count: 0, people: 0 }
  ];

  appointments.forEach((appointment) => {
    const hour = Number.parseInt(appointment.startTime.split(":")[0] ?? "0", 10);
    const bucket = buckets.find((item) => hour >= item.start && hour <= item.end);

    if (!bucket) {
      return;
    }

    bucket.count += 1;
    bucket.people += appointment.partySize;
  });

  return buckets.filter((bucket) => bucket.count > 0).sort((left, right) => right.count - left.count);
}

function matchesPeriod(date: string, period: PeriodId, referenceDate: string) {
  if (period === "allTime") {
    return true;
  }

  const appointmentDate = new Date(`${date}T00:00:00`);
  const todayDate = new Date(`${referenceDate}T00:00:00`);

  if (period === "today") {
    return isSameDay(appointmentDate, todayDate);
  }

  if (period === "yesterday") {
    const yesterday = new Date(todayDate);
    yesterday.setDate(todayDate.getDate() - 1);
    return isSameDay(appointmentDate, yesterday);
  }

  if (period === "thisWeek" || period === "lastWeek") {
    const currentWeekStart = getStartOfWeek(todayDate);
    const currentWeekEnd = getEndOfWeek(todayDate);

    if (period === "thisWeek") {
      return appointmentDate >= currentWeekStart && appointmentDate <= currentWeekEnd;
    }

    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(currentWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(currentWeekEnd);
    lastWeekEnd.setDate(currentWeekEnd.getDate() - 7);
    return appointmentDate >= lastWeekStart && appointmentDate <= lastWeekEnd;
  }

  if (period === "thisMonth") {
    return (
      appointmentDate.getFullYear() === todayDate.getFullYear() &&
      appointmentDate.getMonth() === todayDate.getMonth()
    );
  }

  const lastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
  return (
    appointmentDate.getFullYear() === lastMonth.getFullYear() &&
    appointmentDate.getMonth() === lastMonth.getMonth()
  );
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getStartOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getEndOfWeek(date: Date) {
  const result = getStartOfWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(value);
}

function getPercentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  return Math.max(6, (value / total) * 100);
}
