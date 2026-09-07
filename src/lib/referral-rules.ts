export type ReferralAccessSource = "free" | "paid" | "referral";

export function normalizeReferralCode(value: string | null | undefined) {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24) ?? "";
}

export function getEffectiveSubscriptionTier(accessSource: ReferralAccessSource, fallbackTier: "free" | "pro") {
  if (accessSource === "free") {
    return fallbackTier === "pro" ? "pro" : "free";
  }

  return "pro";
}
