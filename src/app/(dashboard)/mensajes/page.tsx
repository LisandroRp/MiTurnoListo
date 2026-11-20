"use client";

import { MessageTemplatesView } from "@/features/scheduling/components/MessageTemplatesView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";
import { getPlanIncludedIds } from "@/features/scheduling/plan-limits";

export default function MessagesSectionPage() {
  const { businessId, profile, services, locale } = useScheduling();
  if (!businessId) return null;
  const publicServices = services.filter((service) => service.isVisible && !service.isArchived);
  const includedIds = getPlanIncludedIds(publicServices, profile.subscriptionTier, "services");

  return (
    <MessageTemplatesView
      key={`${businessId}-${locale}`}
      businessId={businessId}
      businessName={profile.businessName}
      businessSlug={profile.businessSlug}
      services={publicServices.filter((service) => !includedIds || includedIds.has(service.id))}
      locale={locale}
    />
  );
}
