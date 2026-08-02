"use client";

import { PaymentsView } from "@/features/scheduling/components/PaymentsView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function PaymentsSectionPage() {
  const { businessId, markAppointmentPaid, messages } = useScheduling();

  return (
    <PaymentsView
      businessId={businessId}
      messages={messages}
      onMarkAppointmentPaid={markAppointmentPaid}
    />
  );
}
