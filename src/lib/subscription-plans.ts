export type SubscriptionTier = "free" | "pro" | "unlimited";
export type PaidSubscriptionTier = Exclude<SubscriptionTier, "free">;

export const paidPlanCodes = {
  pro: "miturnolisto-pro",
  unlimited: "miturnolisto-unlimited"
} as const;

export function isPaidSubscriptionTier(value: unknown): value is PaidSubscriptionTier {
  return value === "pro" || value === "unlimited";
}

export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return value === "free" || isPaidSubscriptionTier(value);
}

export function getHighestSubscriptionTier(tiers: readonly unknown[]): SubscriptionTier {
  return tiers.includes("unlimited") ? "unlimited" : tiers.includes("pro") ? "pro" : "free";
}

export function getPaidSubscriptionConfig(tier: PaidSubscriptionTier) {
  const variable = tier === "unlimited" ? "MERCADO_PAGO_UNLIMITED_PRICE_ARS" : "MERCADO_PAGO_PRO_PRICE_ARS";
  const configured = tier === "unlimited" ? process.env.MERCADO_PAGO_UNLIMITED_PRICE_ARS : process.env.MERCADO_PAGO_PRO_PRICE_ARS;
  const amount = Number(configured?.trim() || (tier === "unlimited" ? "55000" : "25000"));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Invalid monthly subscription price: ${variable}.`);
  return { amount, planCode: paidPlanCodes[tier], reason: tier === "unlimited" ? "MiTurnoListo INFINITY" : "MiTurnoListo PRO" };
}
