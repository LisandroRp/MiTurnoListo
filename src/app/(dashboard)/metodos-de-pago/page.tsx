"use client";

import { FiCreditCard } from "react-icons/fi";

import { PremiumFeatureCard } from "@/components/composed/PremiumFeatureCard";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { PaymentMethodsView } from "@/features/scheduling/components/PaymentMethodsView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";
import { isFreePlan } from "@/features/scheduling/plan-limits";

export default function PaymentMethodsSectionPage() {
  const { messages, paymentSettings, profile, savePaymentSettings } = useScheduling();

  if (isFreePlan(profile.subscriptionTier)) {
    return (
      <div className="grid gap-6">
        <SectionHeader icon={<FiCreditCard />} eyebrow={messages.adminPaymentMethods.eyebrow} title={messages.adminPaymentMethods.title} description={messages.adminPaymentMethods.description} />
        <div className="grid min-h-[60vh] place-items-center">
        <PremiumFeatureCard
          badge={messages.adminPaymentMethods.lockedBadge}
          title={messages.adminPaymentMethods.lockedTitle}
          description={messages.adminPaymentMethods.lockedDescription}
          actionLabel={messages.adminPaymentMethods.lockedAction}
        />
        </div>
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
