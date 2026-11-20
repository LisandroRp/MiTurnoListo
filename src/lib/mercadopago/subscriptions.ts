import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildSubscriptionExternalReference,
  extractBusinessIdFromExternalReference,
  getSubscriptionPlanFromReference,
  mapMercadoPagoStatusToTier
} from "@/lib/mercadopago/subscription-status";
import { getMercadoPagoPublicOrigin } from "@/lib/mercadopago/checkout";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { reconcileReferralAccessForBusiness, rewardReferralForBusinessPayment } from "@/lib/referrals";
import { isUuid } from "@/lib/slugs";

import { getPaidSubscriptionConfig, isPaidSubscriptionTier, paidPlanCodes, type PaidSubscriptionTier } from "@/lib/subscription-plans";
import { withSubscriptionVerification } from "@/lib/mercadopago/subscription-verification";
import { SubscriptionVerificationError, classifySubscriptionVerificationFailure, type SubscriptionVerificationNotice } from "@/lib/mercadopago/subscription-verification-policy";
import { reconcileSubscriptionEntitlement } from "@/lib/subscription-entitlements";

const mercadoPagoSubscriptionApiBaseUrl = "https://api.mercadopago.com/preapproval";
const mercadoPagoPaymentApiBaseUrl = "https://api.mercadopago.com/v1/payments";
const defaultCurrencyId = "ARS";
const defaultFrequency = 1;
const defaultFrequencyType = "months";

type MercadoPagoSubscription = {
  date_created?: string;
  external_reference?: string | null;
  id?: string;
  init_point?: string;
  last_modified?: string;
  payer_email?: string;
  preapproval_plan_id?: string | null;
  status?: string;
};

type MercadoPagoSubscriptionSearchResponse = {
  results?: MercadoPagoSubscription[];
};

type MercadoPagoSubscriptionPayment = {
  currency_id?: string;
  date_approved?: string | null;
  date_created?: string | null;
  external_reference?: string | null;
  id?: number | string;
  metadata?: Record<string, unknown> | null;
  preapproval_id?: string | null;
  status?: string;
  transaction_amount?: number | string | null;
};

type StoredBusinessSubscription = {
  business_id: string;
  id: string;
  provider_status: string;
  provider_subscription_id: string | null;
  provider_plan_id?: string;
  started_at?: string | null;
  cancelled_at?: string | null;
};

export type SubscriptionStatusResult = {
  businessId: string | null;
  preapprovalId: string;
  status: string;
  verification?: SubscriptionVerificationNotice;
  subscriptionTier: "free" | "pro" | "unlimited";
};

export async function createProSubscriptionCheckout({
  businessId,
  payerEmail,
  requestOrigin,
  userId,
  plan = "pro"
}: {
  businessId: string;
  payerEmail: string;
  requestOrigin: string;
  userId: string;
  plan?: PaidSubscriptionTier;
}) {
  const config = getSubscriptionConfig(plan);
  if (!config.webhookToken) throw new Error("Configure MP_WEBHOOK_TOKEN before creating subscriptions.");
  const supabase = getSupabaseAdminClient();
  const intentId = await createPendingBusinessSubscriptionAttempt({
    businessId,
    planId: config.planCode,
    userId
  });
  const origin = getMercadoPagoPublicOrigin(requestOrigin);
  const businessReferenceKey = businessId;
  const externalReference = buildSubscriptionExternalReference(businessReferenceKey, userId, intentId, plan);
  const response = await fetch(mercadoPagoSubscriptionApiBaseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      auto_recurring: {
        currency_id: defaultCurrencyId,
        frequency: config.frequency,
        frequency_type: config.frequencyType,
        transaction_amount: config.transactionAmount
      },
      back_url: `${origin}/perfil`,
      external_reference: externalReference,
      notification_url: `${origin}/api/mercadopago/subscription-webhook${config.webhookToken ? `?token=${encodeURIComponent(config.webhookToken)}` : ""}`,
      payer_email: config.testPayerEmail || payerEmail,
      reason: config.reason,
      status: "pending"
    })
  });
  const payload = await response.json().catch(() => null) as (MercadoPagoSubscription & {
    message?: string;
  }) | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "No pudimos iniciar la suscripción en Mercado Pago.");
  }

  if (!payload?.id || !payload.init_point) {
    throw new Error("Mercado Pago no devolvió una URL de checkout para la suscripción.");
  }

  await persistBusinessSubscriptionState({
    businessId,
    subscription: payload
  });

  return {
    checkoutUrl: payload.init_point,
    preapprovalId: payload.id,
    status: payload.status ?? "pending"
  };
}

export async function changeBusinessSubscriptionPlan({ businessId, preapprovalId, plan }: {
  businessId: string;
  preapprovalId: string;
  plan: PaidSubscriptionTier;
}) {
  const subscription = await getSubscriptionById(preapprovalId);
  const supabase = getSupabaseAdminClient();
  if (await resolveBusinessIdForSubscription(supabase, subscription) !== businessId) throw new Error("Subscription does not belong to this business.");
  if (subscription.status !== "authorized" || subscription.preapproval_plan_id) throw new Error("This subscription cannot change plans automatically.");
  const config = getSubscriptionConfig(plan);
  const stored = await findStoredBusinessSubscriptionByProviderId(supabase, preapprovalId);
  if (!stored?.id) throw new Error("The subscription must be synchronized before changing plans.");
  const externalReference = buildSubscriptionExternalReference(businessId, await findBusinessOwnerUserId(supabase, businessId), stored.id, plan);
  // Update the existing monthly authorization; do not create another subscription or an immediate payment.
  const response = await fetch(`${mercadoPagoSubscriptionApiBaseUrl}/${encodeURIComponent(preapprovalId)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auto_recurring: { transaction_amount: config.transactionAmount, currency_id: defaultCurrencyId, frequency: 1, frequency_type: "months" },
      reason: config.reason,
      external_reference: externalReference
    })
  });
  const updated = await response.json().catch(() => null) as MercadoPagoSubscription | null;
  if (!response.ok || updated?.id !== preapprovalId || updated.status !== "authorized") throw new Error("Mercado Pago did not confirm the subscription change.");
  await persistBusinessSubscriptionState({ businessId, subscription: { ...subscription, ...updated, external_reference: externalReference } });
  await updateBusinessSubscriptionTier(businessId);
  await reconcileReferralAccessForBusiness({ businessId, supabase });
  return { businessId, preapprovalId, status: "authorized", subscriptionTier: await getEffectiveBusinessTier(businessId) } satisfies SubscriptionStatusResult;
}

export async function syncSubscriptionTierByPreapprovalId(preapprovalId: string) {
  const subscription = await getSubscriptionById(preapprovalId);
  const supabase = getSupabaseAdminClient();
  const businessId = await resolveBusinessIdForSubscription(supabase, subscription);

  if (!businessId) {
    return {
      businessId: null,
      preapprovalId,
      status: subscription.status ?? "unknown",
      subscriptionTier: "free"
    } satisfies SubscriptionStatusResult;
  }

  await persistBusinessSubscriptionState({
    businessId,
    subscription
  });
  await updateBusinessSubscriptionTier(businessId, subscription.status);
  await reconcileReferralAccessForBusiness({ businessId, supabase });

  return {
    businessId,
    preapprovalId,
    status: subscription.status ?? "unknown",
    subscriptionTier: await getEffectiveBusinessTier(businessId)
  } satisfies SubscriptionStatusResult;
}

export async function syncSubscriptionPaymentByPaymentId(paymentId: string) {
  const payment = await getSubscriptionPaymentById(paymentId);
  const supabase = getSupabaseAdminClient();
  const providerSubscriptionId = getSubscriptionIdFromPayment(payment);
  const businessId = await resolveBusinessIdForSubscriptionPayment({
    payment,
    providerSubscriptionId,
    supabase
  });

  if (!businessId || !payment.id) {
    return null;
  }

  await persistBusinessSubscriptionPayment({
    businessId,
    payment,
    providerSubscriptionId
  });
  await rewardReferralForBusinessPayment({
    businessId,
    paymentId: String(payment.id),
    paymentStatus: payment.status,
    supabase
  });

  return {
    amount: Number(payment.transaction_amount ?? 0),
    businessId,
    paymentId: String(payment.id),
    providerSubscriptionId,
    status: payment.status ?? "unknown"
  };
}

export async function syncBusinessSubscriptionByPreapprovalId({
  businessId,
  preapprovalId
}: {
  businessId: string;
  preapprovalId: string;
}) {
  const stored = await findStoredBusinessSubscriptionByProviderId(getSupabaseAdminClient(), preapprovalId);
  if (stored && stored.business_id !== businessId) throw new Error("Subscription does not belong to this business.");
  const subscription = await getSubscriptionById(preapprovalId);

  const resolvedBusinessId = await resolveBusinessIdForSubscription(getSupabaseAdminClient(), subscription);
  if (resolvedBusinessId !== businessId) throw new Error("Subscription does not belong to this business.");

  await persistBusinessSubscriptionState({
    businessId,
    subscription
  });
  await updateBusinessSubscriptionTier(businessId, subscription.status);
  await reconcileReferralAccessForBusiness({
    businessId,
    supabase: getSupabaseAdminClient()
  });

  return {
    businessId,
    preapprovalId,
    status: subscription.status ?? "unknown",
    subscriptionTier: await getEffectiveBusinessTier(businessId)
  } satisfies SubscriptionStatusResult;
}

export async function verifyBusinessSubscriptionStatus({ businessId, payerEmail, preapprovalId }: {
  businessId: string; payerEmail: string; preapprovalId?: string;
}): Promise<SubscriptionStatusResult> {
  const stored = preapprovalId
    ? await findStoredBusinessSubscriptionByProviderId(getSupabaseAdminClient(), preapprovalId)
    : await findLatestStoredBusinessSubscription(businessId);
  if (preapprovalId && (!stored || stored.business_id !== businessId)) throw new Error("La suscripción no pertenece a este negocio.");

  if (stored && (isCancelledSubscriptionStatus(stored.provider_status) || stored.provider_status === "invalid")) {
    await updateBusinessSubscriptionTier(businessId);
    await reconcileReferralAccessForBusiness({ businessId, supabase: getSupabaseAdminClient() });
    return { businessId, preapprovalId: stored.provider_subscription_id ?? "", status: stored.provider_status, subscriptionTier: await getEffectiveBusinessTier(businessId) };
  }
  return withSubscriptionVerification({
    businessId, reference: stored?.provider_subscription_id ? `subscription:${stored.provider_subscription_id}` : "discovery",
    verify: () => preapprovalId
      ? syncBusinessSubscriptionByPreapprovalId({ businessId, preapprovalId })
      : syncLatestBusinessSubscriptionUnchecked({ businessId, payerEmail })
  });
}

export async function syncLatestBusinessSubscription(input: { businessId: string; payerEmail: string }) {
  return verifyBusinessSubscriptionStatus(input);
}

async function syncLatestBusinessSubscriptionUnchecked({
  businessId,
  payerEmail
}: {
  businessId: string;
  payerEmail: string;
}) {
  const storedSubscription = await findLatestStoredBusinessSubscription(businessId);

  if (storedSubscription && isCancelledSubscriptionStatus(storedSubscription.provider_status)) {
    await updateBusinessSubscriptionTier(businessId);
    await reconcileReferralAccessForBusiness({ businessId, supabase: getSupabaseAdminClient() });

    return {
      businessId,
      preapprovalId: storedSubscription.provider_subscription_id ?? "",
      status: storedSubscription.provider_status,
      subscriptionTier: await getEffectiveBusinessTier(businessId)
    } satisfies SubscriptionStatusResult;
  }

  if (storedSubscription?.provider_subscription_id) {
    const status = await syncBusinessSubscriptionByPreapprovalId({
      businessId,
      preapprovalId: storedSubscription.provider_subscription_id
    });

    if (status && (isPaidSubscriptionTier(status.subscriptionTier) || !isCancelledSubscriptionStatus(status.status))) {
      return status;
    }
  }

  const pendingAttempt = await findLatestPendingBusinessSubscriptionAttempt({
    businessId,
    planId: getSubscriptionConfig().planCode
  });

  if (pendingAttempt?.id) {
    return {
      businessId,
      preapprovalId: "",
      status: "none",
      subscriptionTier: await getEffectiveBusinessTier(businessId)
    } satisfies SubscriptionStatusResult;
  }

  const subscription = await findLatestBusinessSubscription({
    businessId,
    payerEmail
  });

  if (!subscription?.id) {
    await updateBusinessSubscriptionTier(businessId, "free");
    await reconcileReferralAccessForBusiness({
      businessId,
      supabase: getSupabaseAdminClient()
    });

    return {
      businessId,
      preapprovalId: "",
      status: "none",
      subscriptionTier: await getEffectiveBusinessTier(businessId)
    } satisfies SubscriptionStatusResult;
  }

  return syncSubscriptionTierByPreapprovalId(subscription.id);
}

export async function cancelLatestBusinessSubscription({
  businessId,
  payerEmail
}: {
  businessId: string;
  payerEmail: string;
}) {
  const storedSubscription = await findLatestStoredBusinessSubscription(businessId);
  const subscription = storedSubscription?.provider_subscription_id
    ? await getSubscriptionById(storedSubscription.provider_subscription_id)
    : await findLatestBusinessSubscription({
        businessId,
        payerEmail
      });

  if (!subscription?.id) {
    await updateBusinessSubscriptionTier(businessId, "free");

    return {
      businessId,
      preapprovalId: "",
      status: "none",
      subscriptionTier: await getEffectiveBusinessTier(businessId)
    } satisfies SubscriptionStatusResult;
  }

  if (isCancelledSubscriptionStatus(subscription.status)) {
    await persistBusinessSubscriptionState({
      businessId,
      subscription
    });
    await updateBusinessSubscriptionTier(businessId, subscription.status);
    await reconcileReferralAccessForBusiness({
      businessId,
      supabase: getSupabaseAdminClient()
    });

    return {
      businessId,
      preapprovalId: subscription.id,
      status: subscription.status ?? "cancelled",
      subscriptionTier: await getEffectiveBusinessTier(businessId)
    } satisfies SubscriptionStatusResult;
  }

  const config = getSubscriptionConfig();
  const response = await fetch(`${mercadoPagoSubscriptionApiBaseUrl}/${encodeURIComponent(subscription.id)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status: "cancelled"
    })
  });

  const payload = await response.json().catch(() => null) as {
    message?: string;
    status?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "No pudimos cancelar la suscripción en Mercado Pago.");
  }

  await persistBusinessSubscriptionState({
    businessId,
    subscription: {
      ...subscription,
      status: payload?.status ?? "cancelled"
    }
  });
  await updateBusinessSubscriptionTier(businessId, payload?.status);
  await reconcileReferralAccessForBusiness({
    businessId,
    supabase: getSupabaseAdminClient()
  });

  return {
    businessId,
    preapprovalId: subscription.id,
    status: payload?.status ?? "cancelled",
    subscriptionTier: await getEffectiveBusinessTier(businessId)
  } satisfies SubscriptionStatusResult;
}

async function findLatestBusinessSubscription({
  businessId,
  payerEmail
}: {
  businessId: string;
  payerEmail: string;
}) {
  const supabase = getSupabaseAdminClient();
  const businessReferenceKey = await getBusinessSubscriptionReferenceKey(supabase, businessId);
  const subscriptions = await searchSubscriptions({ payerEmail });

  return subscriptions
    .filter((subscription) => {
      const externalBusinessId = extractBusinessIdFromExternalReference(subscription.external_reference);

      if (externalBusinessId) {
        return externalBusinessId === businessId || externalBusinessId === businessReferenceKey;
      }

      return false;
    })
    .sort((left, right) => {
      const leftValue = Date.parse(left.last_modified ?? left.date_created ?? "");
      const rightValue = Date.parse(right.last_modified ?? right.date_created ?? "");
      return rightValue - leftValue;
    })[0] ?? null;
}

async function fetchSubscriptionVerification(url: string, options: RequestInit) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(8_000) });
  } catch {
    throw new SubscriptionVerificationError("temporary");
  }
}

async function searchSubscriptions({ payerEmail }: { payerEmail: string }) {
  const config = getSubscriptionConfig();
  const searchParams = new URLSearchParams();
  searchParams.set("payer_email", payerEmail);

  const response = await fetchSubscriptionVerification(`${mercadoPagoSubscriptionApiBaseUrl}/search?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`
    },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null) as MercadoPagoSubscriptionSearchResponse & {
    message?: string;
  } | null;

  if (!response.ok || !Array.isArray(payload?.results)) {
    throw new SubscriptionVerificationError(classifySubscriptionVerificationFailure(response.status, payload?.message));
  }

  return payload.results;
}

async function getSubscriptionById(preapprovalId: string) {
  const config = getSubscriptionConfig();
  const response = await fetchSubscriptionVerification(`${mercadoPagoSubscriptionApiBaseUrl}/${encodeURIComponent(preapprovalId)}`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`
    },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null) as (MercadoPagoSubscription & {
    message?: string;
  }) | null;

  if (!response.ok || !payload?.id || !["authorized", "pending", "paused", "cancelled", "canceled"].includes(payload.status ?? "")) {
    throw new SubscriptionVerificationError(classifySubscriptionVerificationFailure(response.status, payload?.message));
  }

  return payload;
}

async function getSubscriptionPaymentById(paymentId: string) {
  const config = getSubscriptionConfig();
  const response = await fetch(`${mercadoPagoPaymentApiBaseUrl}/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`
    },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null) as (MercadoPagoSubscriptionPayment & {
    message?: string;
  }) | null;

  if (!response.ok || !payload?.id) {
    throw new Error(payload?.message ?? "No pudimos verificar el pago de la suscripción en Mercado Pago.");
  }

  return payload;
}

async function createPendingBusinessSubscriptionAttempt({
  businessId,
  planId,
  userId
}: {
  businessId: string;
  planId: string;
  userId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const pendingAttempt = await findLatestPendingBusinessSubscriptionAttempt({
    businessId,
    planId
  });
  const now = new Date().toISOString();

  if (pendingAttempt?.id) {
    const { error } = await supabase
      .from("business_subscriptions")
      .update({
        provider_status: "pending",
        subscription_tier: "free",
        updated_at: now
      })
      .eq("id", pendingAttempt.id);

    if (error) {
      throw new Error("No pudimos preparar la suscripción del negocio.");
    }

    return pendingAttempt.id;
  }

  const { data, error } = await supabase
    .from("business_subscriptions")
    .insert({
      business_id: businessId,
      provider: "mercadopago",
      provider_plan_id: planId,
      provider_status: "pending",
      subscription_tier: "free",
      updated_at: now,
      user_id: userId
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error("No pudimos preparar la suscripción del negocio.");
  }

  return data.id as string;
}

async function findLatestStoredBusinessSubscription(businessId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_subscriptions")
    .select("business_id, id, provider_status, provider_subscription_id, provider_plan_id, started_at, cancelled_at")
    .eq("business_id", businessId)
    .eq("provider", "mercadopago")
    .in("provider_plan_id", Object.values(paidPlanCodes))
    .not("provider_subscription_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos consultar la suscripción guardada.");
  }

  return data as StoredBusinessSubscription | null;
}

async function persistBusinessSubscriptionState({
  businessId,
  subscription
}: {
  businessId: string;
  subscription: MercadoPagoSubscription;
}) {
  if (!subscription.id) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const existingRecord = await findStoredBusinessSubscriptionByProviderId(supabase, subscription.id);
  const plan = subscription.external_reference?.includes("|p:")
    ? getSubscriptionPlanFromReference(subscription.external_reference)
    : existingRecord?.provider_plan_id === paidPlanCodes.unlimited ? "unlimited" : "pro";
  const subscriptionTier = mapMercadoPagoStatusToTier(subscription.status, plan);
  const providerPlanId = subscription.preapproval_plan_id ?? paidPlanCodes[plan];
  const payload = {
    business_id: businessId,
    provider: "mercadopago",
    provider_plan_id: providerPlanId,
    provider_status: subscription.status ?? "unknown",
    provider_subscription_id: subscription.id,
    subscription_tier: subscriptionTier,
    ...(isPaidSubscriptionTier(subscriptionTier) ? { started_at: existingRecord?.started_at ?? now } : {}),
    ...(isCancelledSubscriptionStatus(subscription.status) ? { cancelled_at: existingRecord?.cancelled_at ?? now } : {}),
    last_synced_at: now,
    updated_at: now
  };
  if (existingRecord?.id) {
    const { error } = await supabase
      .from("business_subscriptions")
      .update(payload)
      .eq("id", existingRecord.id);

    if (error) {
      throw new Error("No pudimos guardar el estado de la suscripción.");
    }

    return;
  }

  const pendingAttempt = await findLatestPendingBusinessSubscriptionAttempt({
    businessId,
    planId: providerPlanId
  });

  if (pendingAttempt?.id) {
    const { error } = await supabase
      .from("business_subscriptions")
      .update(payload)
      .eq("id", pendingAttempt.id);

    if (error) {
      throw new Error("No pudimos guardar el estado de la suscripción.");
    }

    return;
  }

  const { error } = await supabase
    .from("business_subscriptions")
    .insert({
      ...payload,
      user_id: await findBusinessOwnerUserId(supabase, businessId)
    });

  if (error) {
    throw new Error("No pudimos guardar el estado de la suscripción.");
  }
}

async function findStoredBusinessSubscriptionByProviderId(supabase: SupabaseClient, providerSubscriptionId: string) {
  const { data, error } = await supabase
    .from("business_subscriptions")
    .select("business_id, id, provider_status, provider_subscription_id, provider_plan_id, started_at, cancelled_at")
    .eq("provider", "mercadopago")
    .eq("provider_subscription_id", providerSubscriptionId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos consultar la suscripción guardada.");
  }

  return data as StoredBusinessSubscription | null;
}

async function findLatestPendingBusinessSubscriptionAttempt({
  businessId,
  planId
}: {
  businessId: string;
  planId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_subscriptions")
    .select("business_id, id, provider_status, provider_subscription_id, provider_plan_id, started_at, cancelled_at")
    .eq("business_id", businessId)
    .eq("provider", "mercadopago")
    .eq("provider_plan_id", planId)
    .is("provider_subscription_id", null)
    .eq("provider_status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos consultar el intento de suscripción.");
  }

  return data as StoredBusinessSubscription | null;
}

async function updateBusinessSubscriptionTier(businessId: string, _mercadoPagoStatus?: string) {
  return reconcileSubscriptionEntitlement(getSupabaseAdminClient(), businessId);
}

async function resolveBusinessIdForSubscription(supabase: SupabaseClient, subscription: MercadoPagoSubscription) {
  const externalBusinessId = await resolveBusinessIdFromExternalReference(supabase, subscription.external_reference);

  if (externalBusinessId) {
    return externalBusinessId;
  }

  const storedSubscription = subscription.id
    ? await findStoredBusinessSubscriptionByProviderId(supabase, subscription.id)
    : null;
  // Never infer ownership from another customer's pending checkout or payer email.
  return storedSubscription?.business_id ?? null;
}

async function resolveBusinessIdForSubscriptionPayment({
  payment,
  providerSubscriptionId,
  supabase
}: {
  payment: MercadoPagoSubscriptionPayment;
  providerSubscriptionId: string;
  supabase: SupabaseClient;
}) {
  const metadataBusinessId = getStringMetadataValue(payment.metadata, ["business_id", "businessId"]);

  if (metadataBusinessId) {
    return metadataBusinessId;
  }

  const externalBusinessId = await resolveBusinessIdFromExternalReference(supabase, payment.external_reference);

  if (externalBusinessId) {
    return externalBusinessId;
  }

  if (!providerSubscriptionId) {
    return null;
  }

  const storedSubscription = await findStoredBusinessSubscriptionByProviderId(supabase, providerSubscriptionId);

  return storedSubscription?.business_id ?? null;
}

async function getBusinessSubscriptionReferenceKey(supabase: SupabaseClient, businessId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("public_slug")
    .eq("id", businessId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return businessId;
  }

  return data?.public_slug?.trim() || businessId;
}

async function resolveBusinessIdFromExternalReference(supabase: SupabaseClient, externalReference?: string | null) {
  const businessKey = extractBusinessIdFromExternalReference(externalReference);

  if (!businessKey || isUuid(businessKey)) {
    return businessKey;
  }

  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("public_slug", businessKey)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos encontrar el negocio asociado a la suscripción.");
  }

  return data?.id as string | null ?? null;
}

async function persistBusinessSubscriptionPayment({
  businessId,
  payment,
  providerSubscriptionId
}: {
  businessId: string;
  payment: MercadoPagoSubscriptionPayment;
  providerSubscriptionId: string;
}) {
  if (!payment.id) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("business_subscription_payments")
    .upsert({
      amount: Number(payment.transaction_amount ?? 0),
      business_id: businessId,
      currency: payment.currency_id ?? defaultCurrencyId,
      paid_at: payment.date_approved ?? payment.date_created ?? now,
      provider: "mercadopago",
      provider_payment_id: String(payment.id),
      provider_status: payment.status ?? "unknown",
      provider_subscription_id: providerSubscriptionId || null,
      raw_payload: payment,
      updated_at: now
    }, {
      onConflict: "provider,provider_payment_id"
    });

  if (error) {
    throw new Error("No pudimos guardar el pago de la suscripción.");
  }
}

function getSubscriptionIdFromPayment(payment: MercadoPagoSubscriptionPayment) {
  return payment.preapproval_id ??
    getStringMetadataValue(payment.metadata, [
      "preapproval_id",
      "preapprovalId",
      "provider_subscription_id",
      "subscription_id",
      "subscriptionId"
    ]) ??
    "";
}

function getStringMetadataValue(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!metadata) {
    return "";
  }

  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

async function findBusinessOwnerUserId(supabase: SupabaseClient, businessId: string) {
  const { data, error } = await supabase
    .from("business_memberships")
    .select("user_id")
    .eq("business_id", businessId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (error || !data?.user_id) {
    throw new Error("No pudimos encontrar el dueño del negocio.");
  }

  return data.user_id as string;
}

function isCancelledSubscriptionStatus(status?: string) {
  return status === "cancelled" || status === "canceled";
}

function getSubscriptionConfig(plan: PaidSubscriptionTier = "pro") {
  const accessToken = process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    throw new Error("Configura MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN para habilitar las suscripciones.");
  }

  const planConfig = getPaidSubscriptionConfig(plan);
  const transactionAmount = planConfig.amount;
  const frequency = Number(process.env.MERCADO_PAGO_PRO_FREQUENCY?.trim() || `${defaultFrequency}`);
  const frequencyType = process.env.MERCADO_PAGO_PRO_FREQUENCY_TYPE?.trim() || defaultFrequencyType;
  const webhookToken = process.env.MP_WEBHOOK_TOKEN?.trim() || "";
  const testPayerEmail = process.env.MERCADO_PAGO_TEST_PAYER_EMAIL?.trim() || "";

  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    throw new Error("Configura un precio válido en MERCADO_PAGO_PRO_PRICE_ARS para crear suscripciones.");
  }

  return {
    accessToken,
    frequency,
    frequencyType,
    planCode: planConfig.planCode,
    reason: planConfig.reason,
    testPayerEmail,
    transactionAmount,
    webhookToken
  };
}


async function getEffectiveBusinessTier(businessId: string) {
  const { data, error } = await getSupabaseAdminClient().from("businesses").select("subscription_tier").eq("id", businessId).single();
  if (error || !data) throw new Error("Unable to read subscription access.");
  return data.subscription_tier as "free" | "pro" | "unlimited";
}
