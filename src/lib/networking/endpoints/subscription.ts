"use client";

import { getAccessToken } from "@/lib/networking/endpoints/auth";

export type SubscriptionCheckoutResult = {
  checkoutUrl: string;
  purchase: SubscriptionPurchase | null;
  status: string;
  subscriptionTier: "free" | "pro";
};

export type SubscriptionStatusResult = {
  purchase: SubscriptionPurchase | null;
  status: string;
  subscriptionTier: "free" | "pro";
};

export type SubscriptionPurchase = {
  amount: number;
  currency: string;
  paymentId: string;
};

export async function createProSubscriptionCheckout(businessId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/subscription/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ businessId })
  });

  const payload = await response.json().catch(() => null) as {
    checkoutUrl?: string;
    error?: string;
    purchase?: SubscriptionPurchase | null;
    status?: string;
    subscriptionTier?: "free" | "pro";
  } | null;

  if (!response.ok || !payload?.checkoutUrl || !payload.subscriptionTier || !payload.status) {
    throw new Error(payload?.error ?? "No pudimos iniciar la suscripción al plan Pro.");
  }

  return {
    checkoutUrl: payload.checkoutUrl,
    purchase: payload.purchase ?? null,
    status: payload.status,
    subscriptionTier: payload.subscriptionTier
  } satisfies SubscriptionCheckoutResult;
}

export async function syncProSubscriptionStatus(businessId: string, preapprovalId?: string) {
  const accessToken = await getAccessToken();
  const searchParams = new URLSearchParams({
    businessId
  });

  if (preapprovalId) {
    searchParams.set("preapprovalId", preapprovalId);
  }

  const response = await fetch(`/api/subscription/status?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null) as {
    error?: string;
    purchase?: SubscriptionPurchase | null;
    status?: string;
    subscriptionTier?: "free" | "pro";
  } | null;

  if (!response.ok || !payload?.subscriptionTier || !payload.status) {
    throw new Error(payload?.error ?? "No pudimos verificar el estado de la suscripción.");
  }

  return {
    purchase: payload.purchase ?? null,
    status: payload.status,
    subscriptionTier: payload.subscriptionTier
  } satisfies SubscriptionStatusResult;
}

export async function cancelProSubscription(businessId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/subscription/cancel", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ businessId })
  });

  const payload = await response.json().catch(() => null) as {
    error?: string;
    status?: string;
    subscriptionTier?: "free" | "pro";
  } | null;

  if (!response.ok || !payload?.subscriptionTier || !payload.status) {
    throw new Error(payload?.error ?? "No pudimos cancelar la suscripción.");
  }

  return {
    purchase: null,
    status: payload.status,
    subscriptionTier: payload.subscriptionTier
  } satisfies SubscriptionStatusResult;
}
