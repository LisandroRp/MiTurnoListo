"use client";

import { getAccessToken } from "@/lib/networking/endpoints/auth";

export type SubscriptionCheckoutResult = {
  checkoutUrl: string;
  status: string;
  subscriptionTier: "free" | "pro";
};

export type SubscriptionStatusResult = {
  status: string;
  subscriptionTier: "free" | "pro";
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
    status?: string;
    subscriptionTier?: "free" | "pro";
  } | null;

  if (!response.ok || !payload?.checkoutUrl || !payload.subscriptionTier || !payload.status) {
    throw new Error(payload?.error ?? "No pudimos iniciar la suscripcion al plan Pro.");
  }

  return {
    checkoutUrl: payload.checkoutUrl,
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
    status?: string;
    subscriptionTier?: "free" | "pro";
  } | null;

  if (!response.ok || !payload?.subscriptionTier || !payload.status) {
    throw new Error(payload?.error ?? "No pudimos verificar el estado de la suscripcion.");
  }

  return {
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
    throw new Error(payload?.error ?? "No pudimos cancelar la suscripcion.");
  }

  return {
    status: payload.status,
    subscriptionTier: payload.subscriptionTier
  } satisfies SubscriptionStatusResult;
}
