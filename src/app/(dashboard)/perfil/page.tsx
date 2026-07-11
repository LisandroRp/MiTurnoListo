"use client";

import { useAuth } from "@/features/auth/components/AuthProvider";
import { ProfileView } from "@/features/scheduling/components/ProfileView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function ProfileSectionPage() {
  const { requestPasswordReset, userEmail } = useAuth();
  const {
    messages,
    profile,
    locale,
    theme,
    themeOptions,
    setLocale,
    setTheme,
    setSubscriptionTier,
    showToast
  } = useScheduling();

  async function handlePasswordReset(email: string) {
    const result = await requestPasswordReset(userEmail ?? email);

    if (result.status === "error") {
      showToast({
        tone: "error",
        title: messages.profile.passwordResetErrorTitle,
        description: result.message
      });
      return;
    }

    showToast({
      tone: "success",
      title: messages.profile.passwordResetToastTitle,
      description: messages.profile.passwordResetToastDescription
    });
  }

  return (
    <ProfileView
      messages={messages}
      profile={profile}
      locale={locale}
      theme={theme}
      themeOptions={themeOptions}
      onRequestPasswordReset={handlePasswordReset}
      onLocaleChange={setLocale}
      onThemeChange={setTheme}
      onSubscriptionTierChange={setSubscriptionTier}
    />
  );
}
