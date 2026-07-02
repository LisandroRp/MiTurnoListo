"use client";

import { PaymentMethodsView } from "@/features/scheduling/components/PaymentMethodsView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function PaymentMethodsSectionPage() {
  const { messages, paymentSettings, savePaymentSettings } = useScheduling();

  return (
    <PaymentMethodsView
      messages={messages}
      paymentSettings={paymentSettings}
      onSave={savePaymentSettings}
    />
  );
}
