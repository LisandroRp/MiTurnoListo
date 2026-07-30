"use client";

import { CustomersView } from "@/features/scheduling/components/CustomersView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function CustomersSectionPage() {
  const { businessId, messages } = useScheduling();

  return <CustomersView businessId={businessId} messages={messages} />;
}
