import type { Messages } from "./i18n/messages";
import type { SubscriptionTier } from "./types";

export function getSubscriptionActivationFeedback(messages: Messages, tier: Exclude<SubscriptionTier, "free">) {
  const plan = tier === "unlimited" ? messages.profile.unlimitedPlan : messages.profile.proPlan;
  return {
    title: messages.profile.subscribedToast.replace("{plan}", plan),
    description: messages.profile.subscriptionActivatedDescription.replace("{plan}", plan)
  };
}
