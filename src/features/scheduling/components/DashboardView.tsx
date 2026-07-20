import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/composed/SectionHeader";
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
};

export function DashboardView({ messages, metrics, employees, services, appointments, referenceDate }: DashboardViewProps) {
  const todaysAppointments = appointments.filter((appointment) => appointment.date === referenceDate);

  return (
    <div className="grid gap-6">
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

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-subtle p-5">
            <h2 className="text-lg font-bold text-primary">{messages.home.latestAppointments}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-surface-strong text-left text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">{messages.home.customer}</th>
                  <th className="px-5 py-3 font-semibold">{messages.home.service}</th>
                  <th className="px-5 py-3 font-semibold">{messages.home.employee}</th>
                  <th className="px-5 py-3 font-semibold">{messages.home.time}</th>
                  <th className="px-5 py-3 font-semibold">{messages.home.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {todaysAppointments.map((appointment) => {
                  const service = services.find((item) => item.id === appointment.serviceId);
                  const employee = employees.find((item) => item.id === appointment.employeeId);

                  return (
                    <tr key={appointment.id}>
                      <td className="px-5 py-4 font-semibold text-primary">{appointment.customerName}</td>
                      <td className="px-5 py-4 text-muted">{service?.name}</td>
                      <td className="px-5 py-4 text-muted">{employee?.name}</td>
                      <td className="px-5 py-4 text-muted">{appointment.startTime} - {appointment.endTime}</td>
                      <td className="px-5 py-4">
                        <Badge tone={appointment.status === "confirmed" ? "success" : appointment.status === "pending" ? "warning" : "danger"}>
                          {messages.statuses[appointment.status]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-primary">{messages.home.teamToday}</h2>
          <div className="mt-4 grid gap-3">
            {employees.map((employee) => (
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
