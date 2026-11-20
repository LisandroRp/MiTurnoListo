import type { SubscriptionVerificationNotice } from "@/lib/mercadopago/subscription-verification-policy";
import type { Messages } from "./i18n/messages";
import type { SubscriptionTier } from "./types";

export function getSubscriptionActivationFeedback(messages: Messages, tier: Exclude<SubscriptionTier, "free">) {
  const plan = tier === "unlimited" ? messages.profile.unlimitedPlan : messages.profile.proPlan;
  return {
    title: messages.profile.subscribedToast.replace("{plan}", plan),
    description: messages.profile.subscriptionActivatedDescription.replace("{plan}", plan)
  };
}

export function getSubscriptionVerificationFeedback(messages: Messages, notice?: SubscriptionVerificationNotice) {
  if (!notice?.showNotice || notice.reason === "not_found") return null;
  return {
    title: messages.profile.subscriptionVerificationTitle,
    description: notice.reason === "permission" ? messages.profile.subscriptionVerificationPermission : notice.needsReview ? messages.profile.subscriptionVerificationExhausted : messages.profile.subscriptionVerificationTemporary
  };
}
