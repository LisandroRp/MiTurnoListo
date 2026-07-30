import { FiClock, FiMapPin, FiShield, FiUser } from "react-icons/fi";

import { Card } from "@/components/ui/Card";
import { SummaryRow, SidebarItem } from "@/features/booking-flow/components/BookingFlow/shared/bookingFlowPrimitives";
import { BookingDraft } from "@/features/booking-flow/types";
import { formatLongDate } from "@/features/booking-flow/utils/booking";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Service } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";

export function BookingSidebar({
  messages,
  locale,
  service,
  selectedEmployeeName,
  draft
}: {
  messages: Messages;
  locale: string;
  service: Service;
  selectedEmployeeName: string | null;
  draft: BookingDraft;
}) {
  return (
    <Card className="h-fit lg:sticky lg:top-6">
      <p className="text-sm font-semibold uppercase text-muted">{messages.bookingFlow.steps.summary}</p>
      <h2 className="mt-2 text-2xl font-bold text-primary">{service.name}</h2>
      <div className="mt-5 grid gap-4 text-sm">
        <SidebarItem icon={<FiClock />} label={messages.services.duration} value={`${service.durationMinutes} ${messages.services.minutes}`} />
        <SidebarItem icon={<FiShield />} label={messages.services.price} value={formatCurrency(service.price)} />
        <SidebarItem icon={<FiUser />} label={messages.bookingFlow.summary.employee} value={selectedEmployeeName ?? "-"} />
        <SidebarItem
          icon={<FiMapPin />}
          label={messages.bookingFlow.summary.date}
          value={draft.selectedSlot ? formatLongDate(draft.selectedSlot.date, locale) : "-"}
        />
      </div>
    </Card>
  );
}

export { SummaryRow };
