"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/features/auth/components/AuthProvider";
import { ProfileView } from "@/features/scheduling/components/ProfileView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function ProfileSectionPage() {
  const { requestPasswordReset, userEmail } = useAuth();
  const hasSyncedSubscription = useRef(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    businessId,
    cancelProSubscription,
    messages,
    profile,
    locale,
    refreshWorkspaceSubscription,
    startProSubscription,
    theme,
    themeOptions,
    setLocale,
    setTheme,
    showToast
  } = useScheduling();

  useEffect(() => {
    const subscriptionState = searchParams.get("subscription");
    const preapprovalId = searchParams.get("preapproval_id");

    if ((!preapprovalId && subscriptionState !== "processing") || hasSyncedSubscription.current || !businessId) {
      return;
    }

    hasSyncedSubscription.current = true;

    void refreshWorkspaceSubscription(preapprovalId ?? undefined).then((result) => {
      if (result?.subscriptionTier === "pro") {
        showToast({
          tone: "success",
          title: messages.profile.subscribedToast,
          description: messages.profile.subscriptionActivatedDescription
        });
      } else if (result?.status === "pending") {
        showToast({
          tone: "warning",
          title: messages.profile.subscriptionPendingTitle,
          description: messages.profile.subscriptionPendingDescription
        });
      }

      router.replace(pathname);
    });
  }, [businessId, messages.profile, pathname, refreshWorkspaceSubscription, router, searchParams, showToast]);

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

  async function handleSubscribeToPro() {
    const result = await startProSubscription();

    if (!result) {
      return;
    }

    if (result.subscriptionTier === "pro") {
      return;
    }

    window.location.assign(result.checkoutUrl);
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
      onSubscribeToPro={handleSubscribeToPro}
      onUnsubscribeFromPro={cancelProSubscription}
    />
  );
}
