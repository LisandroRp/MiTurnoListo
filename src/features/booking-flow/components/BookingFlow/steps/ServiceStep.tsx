import { ReactNode } from "react";
import { FiUsers } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { MetricPill } from "@/features/booking-flow/components/BookingFlow/shared/bookingFlowPrimitives";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Employee, Service } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";

export function ServiceStep({
  messages,
  service,
  employees,
  selectedPartySize,
  onPartySizeChange
}: {
  messages: Messages;
  service: Service;
  employees: Employee[];
  selectedPartySize: number;
  onPartySizeChange: (value: number) => void;
}) {
  const maxPeople = Math.max(service.capacity, 1);

  return (
    <Card className="grid gap-5">
      <div>
        <Badge tone={service.isVisible ? "brand" : "warning"}>{messages.bookingFlow.steps.service}</Badge>
        <h2 className="mt-3 text-3xl font-bold text-primary">{service.name}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">{service.description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <EmployeeFact label={messages.services.professionalsColumn} names={employees.map((employee) => employee.name)} />
        <MetricPill label={messages.services.duration} value={`${service.durationMinutes} ${messages.services.minutes}`} />
        <MetricPill label={messages.services.price} value={formatCurrency(service.price)} />
        {service.deposit > 0 ? (
          <MetricPill label={messages.bookingFlow.summary.deposit} value={formatCurrency(service.deposit)} />
        ) : null}
        {service.capacity > 1 ? (
          <MetricPill label={messages.services.capacity} value={formatPeopleCount(service.capacity, messages)} />
        ) : null}
      </div>
      <div className="rounded-2xl border border-subtle bg-input p-4 text-sm font-semibold text-muted">
        {messages.bookingFlow.cancellationPolicy.replace("{time}", formatLeadTime(service.cancellationLeadMinutes))}
      </div>
      {maxPeople > 1 ? (
        <SelectField
          id="party-size"
          label={messages.bookingFlow.partySize}
          value={String(selectedPartySize)}
          onChange={(event) => onPartySizeChange(Number(event.target.value))}
          options={Array.from({ length: maxPeople }, (_, index) => {
            const value = String(index + 1);

            return {
              value,
              label: value
            };
          })}
        />
      ) : null}
    </Card>
  );
}

function EmployeeFact({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-subtle bg-input p-3 [grid-column:1/-1]">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-muted">{label}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {names.map((name) => (
            <span key={name} className="min-w-0 truncate rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatPeopleCount(count: number, messages: Messages) {
  return `${count} ${count === 1 ? messages.services.person : messages.services.people}`;
}

function formatLeadTime(minutes: number) {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;

    return `${days} ${days === 1 ? "día" : "días"}`;
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60;

    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }

  return `${minutes} minutos`;
}
