import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { MetricPill } from "@/features/booking-flow/components/BookingFlow/shared/bookingFlowPrimitives";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Service } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";

export function ServiceStep({
  messages,
  service,
  selectedPartySize,
  onPartySizeChange
}: {
  messages: Messages;
  service: Service;
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
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,9rem),1fr))]">
        <MetricPill label={messages.services.duration} value={`${service.durationMinutes} ${messages.services.minutes}`} />
        <MetricPill label={messages.services.price} value={formatCurrency(service.price)} />
        <MetricPill label={messages.bookingFlow.summary.deposit} value={formatCurrency(service.deposit)} />
        <MetricPill label={messages.services.capacity} value={formatPeopleCount(service.capacity, messages)} />
      </div>
      <div className="rounded-2xl border border-subtle bg-input p-4 text-sm font-semibold text-muted">
        {messages.bookingFlow.cancellationPolicy.replace("{time}", formatLeadTime(service.cancellationLeadMinutes))}
      </div>
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
    </Card>
  );
}

function formatPeopleCount(count: number, messages: Messages) {
  return `${count} ${count === 1 ? messages.services.person : messages.services.people}`;
}

function formatLeadTime(minutes: number) {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;

    return `${days} ${days === 1 ? "dia" : "dias"}`;
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60;

    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }

  return `${minutes} minutos`;
}
