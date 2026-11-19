export type ReferralAccessSource = "free" | "paid" | "referral" | "manual";

export function normalizeReferralCode(value: string | null | undefined) {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24) ?? "";
}

export function getEffectiveSubscriptionTier(accessSource: ReferralAccessSource, fallbackTier: "free" | "pro" | "unlimited") {
  if (fallbackTier === "unlimited") return "unlimited";
  if (accessSource === "free") {
    return fallbackTier === "pro" ? "pro" : "free";
  }

  return "pro";
}
