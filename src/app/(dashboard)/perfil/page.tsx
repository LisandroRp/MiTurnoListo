"use client";

import { ProfileView } from "@/features/scheduling/components/ProfileView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function ProfileSectionPage() {
  const { messages, profile, locale, theme, themeOptions, setLocale, setTheme, setSubscriptionTier } = useScheduling();

  return (
    <ProfileView
      messages={messages}
      profile={profile}
      locale={locale}
      theme={theme}
      themeOptions={themeOptions}
      onLocaleChange={setLocale}
      onThemeChange={setTheme}
      onSubscriptionTierChange={setSubscriptionTier}
    />
  );
}
