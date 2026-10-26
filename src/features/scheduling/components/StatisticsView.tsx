import { sortAppointments, type AppointmentOrder } from "@/features/scheduling/utils/appointment-order";
import { ReactNode, useRef, useState } from "react";
import { FiInfo, FiActivity, FiBarChart2, FiClock, FiDollarSign, FiTrendingUp, FiUsers } from "react-icons/fi";

import { AppointmentCard } from "@/features/scheduling/components/CalendarView";
import { FloatingInfoPopover } from "@/components/ui/FloatingInfoPopover";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { Pagination } from "@/components/ui/Pagination";
import { PremiumFeatureCard } from "@/components/composed/PremiumFeatureCard";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { employeeColorClasses } from "@/features/scheduling/components/employeeColors";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Appointment, AppointmentLifecycleStatus, BusinessDayBlock, Employee, Service } from "@/features/scheduling/types";
import { cx } from "@/components/ui/utils";
import { buildStatisticsPaymentBreakdown, buildStatisticsRevenue, filterStatisticsRevenue, type StatisticsRevenueFilter } from "@/features/scheduling/utils/statistics-revenue";
import { AnalyticsPanel } from "@/features/scheduling/components/StatisticsView/AnalyticsPanel";
import { StatusBreakdown, type StatisticsStatusRow } from "@/features/scheduling/components/StatisticsView/StatusBreakdown";

type StatisticsViewProps = {
  appointments: Appointment[];
  employees: Employee[];
  isLocked?: boolean;
  services: Service[];
  messages: Messages;
  referenceDate: string;
  businessDayBlocks?: BusinessDayBlock[];
  onDeleteAppointment?: (id: string, reason: string) => Promise<boolean> | void;
  onMarkAppointmentPaid?: (id: string, amount?: number, note?: string) => Promise<boolean> | void;
  onMarkAppointmentNoShow?: (id: string) => Promise<boolean> | void;
  onRescheduleAppointment?: (id: string, date: string, employeeId: string, start: string, end: string) => Promise<boolean> | void;
};

type PeriodId = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "allTime";

type StatCard = {
  id: string;
  label: string;
  value: string;
  helper: string;
  filter?: StatisticsRevenueFilter;
  icon: ReactNode;
};

const statusToneMap: Record<AppointmentLifecycleStatus, "success" | "warning" | "danger" | "neutral" | "info"> = {
  scheduled: "warning",
  cancelled: "danger",
  rescheduled: "info",
  no_show: "neutral",
  completed: "success"
};

const periodIds: PeriodId[] = ["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth", "allTime"];

export function StatisticsView({ appointments, employees, isLocked = false, services, messages, referenceDate, businessDayBlocks = [], onDeleteAppointment, onMarkAppointmentPaid, onMarkAppointmentNoShow, onRescheduleAppointment }: StatisticsViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodId>("thisMonth");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("all");
  const [revenueFilter, setRevenueFilter] = useState<StatisticsRevenueFilter>("all");
  const [appointmentPage, setAppointmentPage] = useState(1);
  const [appointmentOrder, setAppointmentOrder] = useState<AppointmentOrder>("activity");
  const [pageSize, setPageSize] = useState(20);
  const appointmentsRef = useRef<HTMLDivElement>(null);
  const activeServices = services.filter((service) => !service.isArchived);
  const activeServiceIds = new Set(activeServices.map((service) => service.id));
  const selectableEmployees = employees.filter((employee) => !employee.isArchived);
  const selectedEmployee = selectableEmployees.find((employee) => employee.id === selectedEmployeeId);
  const filteredAppointments = appointments.filter((appointment) => (
    matchesPeriod(appointment.date, selectedPeriod, referenceDate) &&
    (selectedEmployeeId === "all" || appointment.employeeId === selectedEmployeeId)
  ));
  const activeServiceAppointments = filteredAppointments.filter((appointment) => (
    activeServiceIds.has(appointment.serviceId) &&
    appointment.appointmentStatus !== "rescheduled"
  ));
  const latestAppointments = sortAppointments(filterStatisticsRevenue(filteredAppointments, revenueFilter), appointmentOrder);
  const revenueSummary = buildStatisticsRevenue(filteredAppointments);
  const currentPage = Math.min(appointmentPage, Math.max(1, Math.ceil(latestAppointments.length / pageSize)));
  const pagedAppointments = latestAppointments.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paidAppointments = revenueSummary.paid;
  const pendingAppointments = revenueSummary.pending;
  const cancelledAppointments = filteredAppointments.filter((appointment) => appointment.appointmentStatus === "cancelled");
  const { estimatedRevenue, capturedRevenue, pendingRevenue, averageTicket } = revenueSummary;
  const totalPeople = filteredAppointments.reduce((total, appointment) => total + appointment.partySize, 0);
  const paidShare = filteredAppointments.length > 0 ? (paidAppointments.length / filteredAppointments.length) * 100 : 0;

  function appointmentAction(appointment: Appointment) {
    if (!onDeleteAppointment || !onMarkAppointmentPaid || !onMarkAppointmentNoShow || !onRescheduleAppointment) return null;
    const service = services.find((item) => item.id === appointment.serviceId);
    const employee = employees.find((item) => item.id === appointment.employeeId);
    return <AppointmentCard variant="action" messages={messages} appointment={appointment} service={service} employee={employee} serviceName={service?.name} employeeName={employee?.name} employees={employees} appointments={appointments} businessDayBlocks={businessDayBlocks} onDeleteAppointment={onDeleteAppointment} onMarkAppointmentPaid={onMarkAppointmentPaid} onMarkAppointmentNoShow={onMarkAppointmentNoShow} onRescheduleAppointment={onRescheduleAppointment} />;
  }

  const cards: StatCard[] = [
    {
      id: "total",
      label: messages.statistics.cards.totalAppointments,
      value: String(filteredAppointments.length),
      helper: `${totalPeople} ${messages.statistics.people}`,
      icon: <FiActivity />
    },
    {
      id: "estimated",
      label: messages.statistics.cards.estimatedRevenue,
      value: formatCurrency(estimatedRevenue),
      helper: `${formatCurrency(capturedRevenue)} ${messages.statistics.capturedRevenue.toLowerCase()}`,
      filter: "estimated",
      icon: <FiDollarSign />
    },
    {
      id: "pending",
      label: messages.statistics.cards.pendingRevenue,
      value: formatCurrency(pendingRevenue),
      helper: `${pendingAppointments.length} ${messages.statistics.pendingAppointments.toLowerCase()}`,
      filter: "pending",
      icon: <FiClock />
    },
    {
      id: "avg",
      label: messages.statistics.cards.averageTicket,
      value: formatCurrency(averageTicket),
      helper: messages.statistics.revenuePerBooking,
      icon: <FiTrendingUp />
    },
    {
      id: "confirmed",
      label: messages.statistics.paidAppointments,
      value: String(paidAppointments.length),
      helper: `${Math.round(paidShare)}% ${messages.statistics.paidShare}`,
      filter: "paid",
      icon: <FiBarChart2 />
    },
    {
      id: "cancelled",
      label: messages.statistics.cards.cancellations,
      value: String(cancelledAppointments.length),
      helper: filteredAppointments.length > 0 ? `${Math.round((cancelledAppointments.length / filteredAppointments.length) * 100)}%` : "0%",
      icon: <FiUsers />
    }
  ];

  const topServices = activeServices
    .map((service) => {
      const serviceAppointments = activeServiceAppointments.filter((appointment) => appointment.serviceId === service.id);
      const bookings = serviceAppointments.length;
      const revenue = buildStatisticsRevenue(serviceAppointments).estimatedRevenue;

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
  const weekdayDistribution = buildWeekdayDistribution(filteredAppointments);
  const employeePerformance = employees
    .map((employee) => {
      const employeeAppointments = filteredAppointments.filter((appointment) => appointment.employeeId === employee.id);
      const bookings = employeeAppointments.length;
      const revenue = buildStatisticsRevenue(employeeAppointments);

      return {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        color: employee.color,
        initials: employee.initials,
        bookings,
        revenue: revenue.estimatedRevenue,
        averageTicket: revenue.averageTicket
      };
    })
    .filter((employee) => employee.bookings > 0)
    .sort((left, right) => right.bookings - left.bookings || right.revenue - left.revenue);

  const statusRows = (Object.keys(statusToneMap) as AppointmentLifecycleStatus[]).map((status) => {
    const value = filteredAppointments.filter((appointment) => appointment.appointmentStatus === status).length;
    return {
      id: status, label: messages.appointmentStatuses[status], value,
      percentage: filteredAppointments.length ? (value / filteredAppointments.length) * 100 : 0,
      tone: statusToneMap[status]
    };
  }).filter((row) => row.value > 0);
  const paymentBreakdown = buildStatisticsPaymentBreakdown(filteredAppointments);
  const paymentDefinitions: { id: keyof typeof paymentBreakdown.counts; label: string; tone: StatisticsStatusRow["tone"] }[] = [
    { id: "paid", label: messages.paymentStatuses.paid, tone: "success" },
    { id: "pending", label: messages.statistics.pendingAppointments, tone: "warning" },
    { id: "cancelled", label: messages.statistics.cancelledPaymentBookings, tone: "danger" },
    { id: "refunded", label: messages.paymentStatuses.refunded, tone: "neutral" }
  ];
  const paymentRows = paymentDefinitions.filter((row) => row.id !== "refunded" || paymentBreakdown.counts.refunded > 0).map((row) => {
    const value = paymentBreakdown.counts[row.id];
    return { ...row, value, percentage: paymentBreakdown.total ? (value / paymentBreakdown.total) * 100 : 0 };
  });

  function viewRevenueAppointments(filter: StatisticsRevenueFilter) {
    setAppointmentPage(1);
    setRevenueFilter(filter);
    window.requestAnimationFrame(() => appointmentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="grid min-w-0 gap-6 [overflow-anchor:none]">
      <SectionHeader
        icon={<FiBarChart2 />}
        eyebrow={messages.statistics.eyebrow}
        title={messages.statistics.title}
        description={messages.statistics.description}
      />

      <div className="relative min-w-0">
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
        <div className={cx("grid min-w-0 gap-6", isLocked ? "pointer-events-none select-none blur-sm" : "")}>
      <Card className="bg-brand-soft">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-strong">{messages.statistics.analysisPeriod}</p>
            <h2 className="mt-1 text-lg font-bold text-primary">{messages.statistics.periods[selectedPeriod]}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted">
                {selectedEmployee ? selectedEmployee.name : messages.statistics.allEmployees}
              </p>
              <Badge tone="brand">
                {filteredAppointments.length} {messages.statistics.bookings}
              </Badge>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[28rem]">
            <SelectField
              label={messages.statistics.periodFilter}
              value={selectedPeriod}
              onChange={(event) => { setSelectedPeriod(event.target.value as PeriodId); setAppointmentPage(1); }}
              options={periodIds.map((periodId) => ({
                value: periodId,
                label: messages.statistics.periods[periodId]
              }))}
            />
            <SelectField
              label={messages.statistics.employeeFilter}
              value={selectedEmployeeId}
              onChange={(event) => { setSelectedEmployeeId(event.target.value); setAppointmentPage(1); }}
              options={[
                { value: "all", label: messages.statistics.allEmployees },
                ...selectableEmployees.map((employee) => ({
                  value: employee.id,
                  label: employee.name
                }))
              ]}
            />
          </div>
        </div>
      </Card>

      <section className="grid min-w-0 gap-4 min-[900px]:grid-cols-2 2xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.id} className="min-w-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 break-words">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-brand-strong">{card.label}</p>
                  {card.id === "estimated" ? <FloatingInfoPopover
                    ariaLabel={messages.statistics.cards.estimatedRevenue}
                    className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-strong hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    content={<div className="grid gap-2">
                      <p className="font-semibold text-brand-strong">{messages.statistics.revenueEquation}</p>
                      <p>{messages.statistics.revenueExplanation}</p>
                      <p className="font-semibold text-brand-strong">{formatCurrency(estimatedRevenue)} = {formatCurrency(capturedRevenue)} + {formatCurrency(pendingRevenue)}</p>
                    </div>}
                  ><FiInfo aria-hidden="true" /></FloatingInfoPopover> : null}
                </div>
                <p className="mt-3 text-3xl font-bold text-primary">{card.value}</p>
                <p className="mt-2 text-sm text-muted">{card.helper}</p>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-input text-lg text-primary">
                {card.icon}
              </span>
            </div>
            {card.filter ? <Button variant="ghost" size="sm" className="mt-3 bg-surface-strong hover:bg-brand-soft hover:!text-brand-strong" onClick={() => viewRevenueAppointments(card.filter ?? "all")}>{messages.statistics.viewAppointments}</Button> : null}
          </Card>
        ))}
      </section>


      <section className="grid min-w-0 content-start items-start gap-6 xl:grid-cols-2">
        <AnalyticsPanel controls={messages.statistics} title={messages.statistics.panels.topServices} description={messages.statistics.panels.topServicesHint}>
          {(isExpanded) => topServices.length > 0 ? (
            <div className={cx("grid gap-4", isExpanded && "xl:grid-cols-2")}>
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
          controls={messages.statistics}
          title={messages.statistics.panels.hourlyDistribution}
          description={messages.statistics.panels.hourlyDistributionHint}
        >
          {(isExpanded) => hourlyDistribution.length > 0 ? (
            <div className={cx("grid gap-4", isExpanded && "xl:grid-cols-2")}>
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
        <AnalyticsPanel
          controls={messages.statistics}
          title={messages.statistics.panels.statusBreakdown}
          description={messages.statistics.panels.statusBreakdownHint}
        >
          {(isExpanded) => filteredAppointments.length > 0 ? <StatusBreakdown rows={statusRows} isExpanded={isExpanded} /> : <EmptyState message={messages.statistics.empty} />}
        </AnalyticsPanel>

        <AnalyticsPanel
          controls={messages.statistics}
          title={messages.statistics.panels.paymentBreakdown}
          description={messages.statistics.panels.paymentBreakdownHint}
        >
          {(isExpanded) => paymentBreakdown.total > 0 ? <StatusBreakdown rows={paymentRows} isExpanded={isExpanded} /> : <EmptyState message={messages.statistics.empty} />}
        </AnalyticsPanel>

        <AnalyticsPanel
          controls={messages.statistics}
          title={messages.statistics.panels.employeePerformance}
          description={messages.statistics.panels.employeePerformanceHint}
        >
          {(isExpanded) => employeePerformance.length > 0 ? (
            <div className={cx("grid gap-3", isExpanded && "xl:grid-cols-2")}>
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
                          value={formatCurrency(employee.averageTicket)}
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
        <AnalyticsPanel
          controls={messages.statistics}
          title={messages.statistics.panels.weekdayDistribution}
          description={messages.statistics.panels.weekdayDistributionHint}
        >
          {(isExpanded) => weekdayDistribution.length > 0 ? (
            <div className={cx("grid gap-4", isExpanded && "xl:grid-cols-2")}>
              {weekdayDistribution.map((day) => (
                <MetricBar
                  key={day.id}
                  label={messages.days[day.id]}
                  value={`${day.count} ${messages.statistics.bookings}`}
                  helper={`${day.people} ${messages.statistics.people}`}
                  progress={getPercentage(day.count, weekdayDistribution[0]?.count ?? 0)}
                  toneClass="bg-brand"
                />
              ))}
            </div>
          ) : <EmptyState message={messages.statistics.empty} />}
        </AnalyticsPanel>
      </section>

      <div ref={appointmentsRef} className="min-w-0 scroll-mt-20">
      <Card className="min-w-0">
        <div className="mb-5 flex flex-col gap-4 border-b border-subtle pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-primary">{messages.statistics.panels.latestAppointments}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{messages.statistics.panels.latestAppointmentsHint}</p>
          </div>
          <div className="w-40 shrink-0">
            <SelectField
              label={messages.statistics.perPage}
              value={String(pageSize)}
              onChange={(event) => { setPageSize(Number(event.target.value)); setAppointmentPage(1); }}
              options={[10, 20, 50].map((value) => ({ value: String(value), label: String(value) }))}
            />
          </div>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,16rem)_minmax(12rem,16rem)_1fr] sm:items-end">
          <SelectField
            label={messages.statistics.orderBy}
            value={appointmentOrder}
            onChange={(event) => { setAppointmentOrder(event.target.value as AppointmentOrder); setAppointmentPage(1); }}
            options={[
              { value: "activity", label: messages.statistics.orderActivity },
              { value: "nameAsc", label: messages.statistics.orderNameAsc },
              { value: "nameDesc", label: messages.statistics.orderNameDesc },
              { value: "newest", label: messages.statistics.orderNewest },
              { value: "oldest", label: messages.statistics.orderOldest }
            ]}
          />
          <SelectField
            label={messages.statistics.revenueFilter}
            value={revenueFilter}
            onChange={(event) => { setRevenueFilter(event.target.value as StatisticsRevenueFilter); setAppointmentPage(1); }}
            options={[
              { value: "all", label: messages.statistics.allAppointments },
              { value: "estimated", label: messages.statistics.estimatedFilter },
              { value: "paid", label: messages.statistics.paidFilter },
              { value: "pending", label: messages.statistics.pendingFilter }
            ]}
          />
          <p className="text-sm text-muted">
            {latestAppointments.length} {messages.statistics.bookings} · {revenueFilter === "paid" ? messages.statistics.capturedRevenue : revenueFilter === "pending" ? messages.statistics.cards.pendingRevenue : messages.statistics.cards.estimatedRevenue}: {formatCurrency(buildStatisticsRevenue(latestAppointments).estimatedRevenue)}
          </p>
        </div>
        {latestAppointments.length > 0 ? (
          <>
            <div className="grid min-w-0 gap-3 min-[900px]:hidden">
              {pagedAppointments.map((appointment) => {
                const service = services.find((item) => item.id === appointment.serviceId);
                const employee = employees.find((item) => item.id === appointment.employeeId);

                return (
                  <div key={appointment.id} className="rounded-xl border border-subtle bg-input p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{appointment.customerName}</p>
                        <p className="mt-1 text-sm text-muted">{service?.name ?? "-"}</p>
                      </div>
                      <Badge tone={statusToneMap[appointment.appointmentStatus]} className="justify-center text-center whitespace-nowrap">
                        {messages.appointmentStatuses[appointment.appointmentStatus]}
                      </Badge>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <MiniStat label={messages.home.employee} value={employee?.name ?? "-"} />
                      <MiniStat
                        label={messages.home.time}
                        value={<AppointmentTime appointment={appointment} />}
                      />
                      <MiniStat
                        label={messages.statistics.appointmentAmount}
                        value={<AppointmentAmount appointment={appointment} messages={messages} />}
                      />
                      <div className="rounded-lg border border-subtle bg-surface px-3 py-2">
                        <p className="mb-1 text-xs font-semibold uppercase text-muted">{messages.statistics.paymentColumn}</p>
                        <PaymentStatusBadge appointment={appointment} messages={messages} />
                      </div>
                      <div className="flex justify-end">{appointmentAction(appointment)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden min-w-0 overflow-x-auto min-[900px]:block">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="bg-surface-strong text-left text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{messages.home.customer}</th>
                    <th className="px-4 py-3 font-semibold">{messages.home.service}</th>
                    <th className="px-4 py-3 font-semibold">{messages.home.employee}</th>
                    <th className="px-4 py-3 font-semibold">{messages.home.time}</th>
                    <th className="px-4 py-3 font-semibold">{messages.home.status}</th>
                    <th className="px-4 py-3 font-semibold">{messages.statistics.paymentColumn}</th>
                    <th className="px-4 py-3 font-semibold">{messages.statistics.appointmentAmount}</th>
                    <th className="px-4 py-3 font-semibold">{messages.statistics.actionsColumn}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {pagedAppointments.map((appointment) => {
                    const service = services.find((item) => item.id === appointment.serviceId);
                    const employee = employees.find((item) => item.id === appointment.employeeId);

                    return (
                      <tr key={appointment.id}>
                        <td className="px-4 py-4 font-semibold text-primary">{appointment.customerName}</td>
                        <td className="px-4 py-4 text-muted">{service?.name}</td>
                        <td className="px-4 py-4 text-muted">{employee?.name}</td>
                        <td className="px-4 py-4 text-muted">
                          <AppointmentTime appointment={appointment} />
                        </td>
                        <td className="px-4 py-4">
                          <Badge tone={statusToneMap[appointment.appointmentStatus]} className="justify-center text-center whitespace-nowrap">
                            {messages.appointmentStatuses[appointment.appointmentStatus]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4"><PaymentStatusBadge appointment={appointment} messages={messages} /></td>
                        <td className="px-4 py-4 text-muted"><AppointmentAmount appointment={appointment} messages={messages} /></td>
                        <td className="px-4 py-4">{appointmentAction(appointment)}</td>
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
        <Pagination
          currentPage={currentPage}
          totalItems={latestAppointments.length}
          pageSize={pageSize}
          onPageChange={setAppointmentPage}
          labels={{
            summary: messages.statistics.paginationSummary,
            previous: messages.statistics.previousPage,
            next: messages.statistics.nextPage,
            navigation: messages.statistics.panels.latestAppointments
          }}
        />
      </Card>
      </div>
        </div>
      </div>
    </div>
  );
}

function AppointmentTime({ appointment }: { appointment: Appointment }) {
  const [year, month, day] = appointment.date.split("-");
  return <span className="inline-flex flex-col gap-1"><span className="whitespace-nowrap">{day}/{month}/{year}</span><span className="whitespace-nowrap">{appointment.startTime} – {appointment.endTime}</span></span>;
}

function AppointmentAmount({ appointment, messages }: { appointment: Appointment; messages: Messages }) {
  const note = appointment.paymentNote?.trim();
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{formatCurrency(appointment.revenue)}</span>
      {note ? <FloatingInfoPopover
        ariaLabel={messages.calendar.paymentAdditionalInfo}
        className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-strong hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        content={<p className="whitespace-pre-wrap break-words text-sm font-normal">{note}</p>}
      ><FiInfo aria-hidden="true" /></FloatingInfoPopover> : null}
    </span>
  );
}

function PaymentStatusBadge({ appointment, messages }: { appointment: Appointment; messages: Messages }) {
  return (
    <span title={messages.paymentStatuses[appointment.paymentStatus]}>
      <Badge tone={appointment.paymentStatus === "paid" ? "success" : appointment.paymentStatus === "pending" ? "warning" : "neutral"} className="justify-center whitespace-nowrap text-center">
        {appointment.paymentStatus === "pending" ? messages.statistics.paymentPendingShort : messages.paymentStatuses[appointment.paymentStatus]}
      </Badge>
    </span>
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

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-subtle bg-surface px-3 py-2">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <div className="mt-1 text-sm font-bold text-primary">{value}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-muted">{message}</p>;
}

function buildWeekdayDistribution(appointments: Appointment[]) {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  const buckets = days.map((id) => ({ id, count: 0, people: 0 }));
  for (const appointment of appointments) {
    if (appointment.appointmentStatus === "cancelled" || appointment.appointmentStatus === "rescheduled") continue;
    const weekday = new Date(`${appointment.date}T12:00:00Z`).getUTCDay();
    if (!Number.isFinite(weekday)) continue;
    const bucket = buckets[(weekday + 6) % 7];
    bucket.count += 1;
    bucket.people += appointment.partySize;
  }
  return buckets.some((bucket) => bucket.count > 0) ? buckets.sort((left, right) => right.count - left.count) : [];
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
