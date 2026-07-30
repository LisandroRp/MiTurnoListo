import { Card } from "@/components/ui/Card";
import { SummaryRow } from "@/features/booking-flow/components/BookingFlow/shared/bookingFlowPrimitives";
import { BookingDraft } from "@/features/booking-flow/types";
import { formatLongDate } from "@/features/booking-flow/utils/booking";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Service } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";

export function SummaryStep({
  messages,
  locale,
  service,
  employeeName,
  draft
}: {
  messages: Messages;
  locale: string;
  service: Service;
  employeeName: string;
  draft: BookingDraft;
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
        <SummaryRow
          label={messages.bookingFlow.summary.payment}
          value={draft.paymentOption ? messages.bookingFlow.paymentOptions[draft.paymentOption] : "-"}
        />
        <SummaryRow label={messages.bookingFlow.summary.customer} value={draft.customer.fullName || "-"} />
        <SummaryRow label={messages.bookingFlow.summary.attendees} value={String(draft.partySize)} />
        <SummaryRow label={messages.bookingFlow.summary.deposit} value={formatCurrency(service.deposit)} />
        <SummaryRow label={messages.bookingFlow.summary.total} value={formatCurrency(service.price)} />
      </Card>
    </div>
  );
}
