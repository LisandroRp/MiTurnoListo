"use client";

import { SuggestionsView } from "@/features/scheduling/components/SuggestionsView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function SuggestionsSectionPage() {
  const { businessId, locale, messages } = useScheduling();

  return <SuggestionsView businessId={businessId} locale={locale} messages={messages} />;
}
