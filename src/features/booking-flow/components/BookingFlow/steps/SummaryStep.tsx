import { Card } from "@/components/ui/Card";
import { SummaryRow } from "@/features/booking-flow/components/BookingFlow/shared/bookingFlowPrimitives";
import { BookingDraft } from "@/features/booking-flow/types";
import { formatLongDate } from "@/features/booking-flow/utils/booking";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Service, ServiceAddon } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";

export function SummaryStep({
  messages,
  locale,
  service,
  employeeName,
  draft,
  selectedAddons,
  total
}: {
  messages: Messages;
  locale: string;
  service: Service;
  employeeName: string;
  draft: BookingDraft;
  selectedAddons: ServiceAddon[];
  total: number;
}) {
  return (
    <div className="grid gap-4">
      <Card className="bg-brand-soft">
        <h2 className="text-xl font-bold text-primary">{messages.bookingFlow.summaryTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{messages.bookingFlow.summaryHint}</p>
      </Card>
      <Card className="grid gap-4">
        <SummaryRow label={messages.bookingFlow.summary.service} value={service.name} />
        <SummaryRow label={messages.bookingFlow.summary.employee} value={employeeName} />
        <SummaryRow
          label={messages.bookingFlow.summary.date}
          value={draft.selectedSlot ? formatLongDate(draft.selectedSlot.date, locale) : "-"}
        />
        <SummaryRow
          label={messages.bookingFlow.summary.time}
          value={draft.selectedSlot ? `${draft.selectedSlot.startTime} - ${draft.selectedSlot.endTime}` : "-"}
        />
        <SummaryRow label={messages.bookingFlow.basePrice} value={formatCurrency(service.price)} />
        {selectedAddons.length > 0 ? (
          selectedAddons.map((addon) => (
            <SummaryRow key={addon.id} label={addon.name} value={`+ ${formatCurrency(addon.price)}`} />
          ))
        ) : (
          <SummaryRow label={messages.bookingFlow.summary.addons} value="-" />
        )}
        <SummaryRow
          label={messages.bookingFlow.summary.payment}
          value={draft.paymentOption ? messages.bookingFlow.paymentOptions[draft.paymentOption] : "-"}
        />
        <SummaryRow label={messages.bookingFlow.summary.customer} value={draft.customer.fullName || "-"} />
        <SummaryRow label={messages.bookingFlow.summary.attendees} value={String(draft.partySize)} />
        <SummaryRow label={messages.bookingFlow.summary.deposit} value={formatCurrency(service.deposit * draft.partySize)} />
        <SummaryRow label={messages.bookingFlow.summary.total} value={formatCurrency(total)} />
      </Card>
      <Card className="border-brand bg-brand-soft">
        <p className="text-sm font-semibold text-primary">
          {messages.bookingFlow.cancellationPolicy.replace("{time}", formatLeadTime(service.cancellationLeadMinutes))}
        </p>
      </Card>
    </div>
  );
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
