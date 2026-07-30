import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
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
        <MetricPill label={messages.services.capacity} value={`${service.capacity} ${messages.services.people}`} />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-primary" htmlFor="party-size">
          {messages.bookingFlow.partySize}
        </label>
        <select
          id="party-size"
          value={selectedPartySize}
          onChange={(event) => onPartySizeChange(Number(event.target.value))}
          className="h-11 cursor-pointer rounded-xl border border-subtle bg-input px-3 text-sm text-primary outline-none focus:border-brand focus:ring-2 focus:ring-focus"
        >
          {Array.from({ length: maxPeople }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );
}
