"use client";

import { PremiumFeatureCard } from "@/components/composed/PremiumFeatureCard";
import { PaymentMethodsView } from "@/features/scheduling/components/PaymentMethodsView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";
import { isFreePlan } from "@/features/scheduling/plan-limits";

export default function PaymentMethodsSectionPage() {
  const { messages, paymentSettings, profile, savePaymentSettings } = useScheduling();

  if (isFreePlan(profile.subscriptionTier)) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <PremiumFeatureCard
          badge={messages.adminPaymentMethods.lockedBadge}
          title={messages.adminPaymentMethods.lockedTitle}
          description={messages.adminPaymentMethods.lockedDescription}
          actionLabel={messages.adminPaymentMethods.lockedAction}
        />
      </div>
    );
  }

  return (
    <PaymentMethodsView
      messages={messages}
      paymentSettings={paymentSettings}
      onSave={savePaymentSettings}
    />
  );
}
