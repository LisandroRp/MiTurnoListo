import { FiCheckCircle } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ReceiptWhatsappNotice } from "@/features/booking-flow/components/BookingFlow/shared/TransferReceipt";
import { SummaryRow } from "@/features/booking-flow/components/BookingFlow/shared/bookingFlowPrimitives";
import { buildReceiptWhatsappMessage, buildWhatsAppHref } from "@/features/booking-flow/components/BookingFlow/utils/bookingFlowUtils";
import { BookingDraft } from "@/features/booking-flow/types";
import { formatLongDate } from "@/features/booking-flow/utils/booking";
import { Messages } from "@/features/scheduling/i18n/messages";
import { BusinessPaymentSettings, Service } from "@/features/scheduling/types";

export function SuccessState({
  messages,
  locale,
  service,
  draft,
  employeeName,
  paymentSettings,
  onMissingCustomerName,
  onReserveAnother
}: {
  messages: Messages;
  locale: string;
  service: Service;
  draft: BookingDraft;
  employeeName: string;
  paymentSettings: BusinessPaymentSettings["transfers"];
  onMissingCustomerName: () => void;
  onReserveAnother: () => void;
}) {
  const whatsappReceiptHref = draft.paymentOption === "transfer" && paymentSettings.receiptWhatsapp
    ? buildWhatsAppHref(
      paymentSettings.receiptWhatsapp,
      buildReceiptWhatsappMessage(messages, locale, service, draft)
    )
    : "";

  return (
    <Card className="mx-auto max-w-2xl text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
        <FiCheckCircle className="text-3xl" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-3xl font-bold text-primary">{messages.bookingFlow.successTitle}</h1>
      <p className="mt-3 text-sm leading-6 text-muted">{messages.bookingFlow.successDescription}</p>
      <div className="mt-6 rounded-2xl border border-subtle bg-input px-5 py-0 text-left">
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
      </div>
      {whatsappReceiptHref ? (
        <div className="mt-4 text-left">
          <ReceiptWhatsappNotice
            messages={messages}
            href={whatsappReceiptHref}
            onClick={(event) => {
              if (!draft.customer.fullName.trim()) {
                event.preventDefault();
                onMissingCustomerName();
              }
            }}
          />
        </div>
      ) : null}
      <div className="mt-6 flex justify-center">
        <Button variant="secondary" onClick={onReserveAnother}>
          {messages.actions.reserveAnother}
        </Button>
      </div>
    </Card>
  );
}
