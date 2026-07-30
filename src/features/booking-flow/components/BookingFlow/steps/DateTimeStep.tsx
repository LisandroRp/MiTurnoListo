import {
  AvailabilityCalendar
} from "@/features/booking-flow/components/AvailabilityCalendar";
import { Card } from "@/components/ui/Card";
import { getAvailableSlotsForEmployee } from "@/features/booking-flow/utils/booking";
import { Messages } from "@/features/scheduling/i18n/messages";

export function DateTimeStep({
  messages,
  locale,
  monthDate,
  slots,
  selectedSlotDate,
  selectedSlotTime,
  onMonthChange,
  onSelectDate,
  onSelectSlot
}: {
  messages: Messages;
  locale: string;
  selectedEmployee: string;
  monthDate: Date;
  slots: ReturnType<typeof getAvailableSlotsForEmployee>;
  selectedSlotDate: string | null;
  selectedSlotTime: string | null;
  onMonthChange: (date: Date) => void;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slot: ReturnType<typeof getAvailableSlotsForEmployee>[number]) => void;
}) {
  return (
    <div className="grid gap-4">
      {slots.length === 0 ? (
        <Card>
          <p className="text-sm font-semibold text-muted">{messages.bookingFlow.noDatesAvailable}</p>
        </Card>
      ) : null}
      <AvailabilityCalendar
        messages={messages}
        locale={locale}
        monthDate={monthDate}
        slots={slots}
        selectedDate={selectedSlotDate}
        selectedStartTime={selectedSlotTime}
        onMonthChange={onMonthChange}
        onSelectDate={onSelectDate}
        onSelectSlot={onSelectSlot}
        showDesktopHours={false}
      />
    </div>
  );
}
