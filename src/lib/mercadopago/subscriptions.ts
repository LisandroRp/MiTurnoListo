import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  buildSubscriptionExternalReference,
  extractBusinessIdFromExternalReference,
  mapMercadoPagoStatusToTier
} from "@/lib/mercadopago/subscription-status";
import { getMercadoPagoPublicOrigin } from "@/lib/mercadopago/checkout";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

const mercadoPagoSubscriptionApiBaseUrl = "https://api.mercadopago.com/preapproval";
const defaultCurrencyId = "ARS";
const defaultFrequency = 1;
const defaultFrequencyType = "months";
const proPlanCode = "miturnolisto-pro";
const proPlanReason = "MiTurnoListo PRO";

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

type StoredBusinessSubscription = {
  business_id: string;
  id: string;
  provider_status: string;
  provider_subscription_id: string | null;
};

export type SubscriptionStatusResult = {
  businessId: string | null;
  preapprovalId: string;
  status: string;
  subscriptionTier: "free" | "pro";
};

export async function createProSubscriptionCheckout({
  businessId,
  payerEmail,
  requestOrigin,
  userId
}: {
  businessId: string;
  payerEmail: string;
  requestOrigin: string;
  userId: string;
}) {
  const config = getSubscriptionConfig();
  const intentId = await createPendingBusinessSubscriptionAttempt({
    businessId,
    planId: config.planCode,
    userId
  });
  const origin = getMercadoPagoPublicOrigin(requestOrigin);
  const externalReference = buildSubscriptionExternalReference(businessId, userId, intentId);
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
      reason: proPlanReason,
      status: "pending"
    })
  });
  const payload = await response.json().catch(() => null) as (MercadoPagoSubscription & {
    message?: string;
  }) | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "No pudimos iniciar la suscripcion en Mercado Pago.");
  }

  if (!payload?.id || !payload.init_point) {
    throw new Error("Mercado Pago no devolvio una URL de checkout para la suscripcion.");
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

  return {
    businessId,
    preapprovalId,
    status: subscription.status ?? "unknown",
    subscriptionTier: mapMercadoPagoStatusToTier(subscription.status)
  } satisfies SubscriptionStatusResult;
}

export async function syncBusinessSubscriptionByPreapprovalId({
  businessId,
  preapprovalId
}: {
  businessId: string;
  preapprovalId: string;
}) {
  const subscription = await getSubscriptionById(preapprovalId);

  await persistBusinessSubscriptionState({
    businessId,
    subscription
  });
  await updateBusinessSubscriptionTier(businessId, subscription.status);

  return {
    businessId,
    preapprovalId,
    status: subscription.status ?? "unknown",
    subscriptionTier: mapMercadoPagoStatusToTier(subscription.status)
  } satisfies SubscriptionStatusResult;
}

export async function syncLatestBusinessSubscription({
  businessId,
  payerEmail
}: {
  businessId: string;
  payerEmail: string;
}) {
  const storedSubscription = await findLatestStoredBusinessSubscription(businessId);

  if (storedSubscription?.provider_subscription_id) {
    const status = await syncBusinessSubscriptionByPreapprovalId({
      businessId,
      preapprovalId: storedSubscription.provider_subscription_id
    });

    if (status.subscriptionTier === "pro" || !isCancelledSubscriptionStatus(status.status)) {
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
      subscriptionTier: "free"
    } satisfies SubscriptionStatusResult;
  }

  const subscription = await findLatestBusinessSubscription({
    businessId,
    payerEmail
  });

  if (!subscription?.id) {
    await updateBusinessSubscriptionTier(businessId, "free");

    return {
      businessId,
      preapprovalId: "",
      status: "none",
      subscriptionTier: "free"
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
      subscriptionTier: "free"
    } satisfies SubscriptionStatusResult;
  }

  if (isCancelledSubscriptionStatus(subscription.status)) {
    await persistBusinessSubscriptionState({
      businessId,
      subscription
    });
    await updateBusinessSubscriptionTier(businessId, subscription.status);

    return {
      businessId,
      preapprovalId: subscription.id,
      status: subscription.status ?? "cancelled",
      subscriptionTier: "free"
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
    throw new Error(payload?.message ?? "No pudimos cancelar la suscripcion en Mercado Pago.");
  }

  await persistBusinessSubscriptionState({
    businessId,
    subscription: {
      ...subscription,
      status: payload?.status ?? "cancelled"
    }
  });
  await updateBusinessSubscriptionTier(businessId, payload?.status);

  return {
    businessId,
    preapprovalId: subscription.id,
    status: payload?.status ?? "cancelled",
    subscriptionTier: "free"
  } satisfies SubscriptionStatusResult;
}

async function findLatestBusinessSubscription({
  businessId,
  payerEmail
}: {
  businessId: string;
  payerEmail: string;
}) {
  const config = getSubscriptionConfig();
  const subscriptions = await searchSubscriptions({ payerEmail });

  return subscriptions
    .filter((subscription) => {
      const externalBusinessId = extractBusinessIdFromExternalReference(subscription.external_reference);

      if (externalBusinessId) {
        return externalBusinessId === businessId;
      }

      return subscription.preapproval_plan_id === config.planCode;
    })
    .sort((left, right) => {
      const leftValue = Date.parse(left.last_modified ?? left.date_created ?? "");
      const rightValue = Date.parse(right.last_modified ?? right.date_created ?? "");
      return rightValue - leftValue;
    })[0] ?? null;
}

async function searchSubscriptions({ payerEmail }: { payerEmail: string }) {
  const config = getSubscriptionConfig();
  const searchParams = new URLSearchParams();
  searchParams.set("payer_email", payerEmail);

  const response = await fetch(`${mercadoPagoSubscriptionApiBaseUrl}/search?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`
    },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null) as MercadoPagoSubscriptionSearchResponse & {
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "No pudimos consultar las suscripciones en Mercado Pago.");
  }

  return payload?.results ?? [];
}

async function getSubscriptionById(preapprovalId: string) {
  const config = getSubscriptionConfig();
  const response = await fetch(`${mercadoPagoSubscriptionApiBaseUrl}/${encodeURIComponent(preapprovalId)}`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`
    },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null) as (MercadoPagoSubscription & {
    message?: string;
  }) | null;

  if (!response.ok || !payload?.id) {
    throw new Error(payload?.message ?? "No pudimos verificar la suscripcion en Mercado Pago.");
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
      throw new Error("No pudimos preparar la suscripcion del negocio.");
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
    throw new Error("No pudimos preparar la suscripcion del negocio.");
  }

  return data.id as string;
}

async function findLatestStoredBusinessSubscription(businessId: string) {
  const config = getSubscriptionConfig();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_subscriptions")
    .select("business_id, id, provider_status, provider_subscription_id")
    .eq("business_id", businessId)
    .eq("provider", "mercadopago")
    .eq("provider_plan_id", config.planCode)
    .not("provider_subscription_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos consultar la suscripcion guardada.");
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
  const subscriptionTier = mapMercadoPagoStatusToTier(subscription.status);
  const providerPlanId = subscription.preapproval_plan_id ?? proPlanCode;
  const payload = {
    business_id: businessId,
    provider: "mercadopago",
    provider_plan_id: providerPlanId,
    provider_status: subscription.status ?? "unknown",
    provider_subscription_id: subscription.id,
    subscription_tier: subscriptionTier,
    ...(subscriptionTier === "pro" ? { started_at: now } : {}),
    ...(isCancelledSubscriptionStatus(subscription.status) ? { cancelled_at: now } : {}),
    last_synced_at: now,
    updated_at: now
  };
  const existingRecord = await findStoredBusinessSubscriptionByProviderId(supabase, subscription.id);

  if (existingRecord?.id) {
    const { error } = await supabase
      .from("business_subscriptions")
      .update(payload)
      .eq("id", existingRecord.id);

    if (error) {
      throw new Error("No pudimos guardar el estado de la suscripcion.");
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
      throw new Error("No pudimos guardar el estado de la suscripcion.");
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
    throw new Error("No pudimos guardar el estado de la suscripcion.");
  }
}

async function findStoredBusinessSubscriptionByProviderId(supabase: SupabaseClient, providerSubscriptionId: string) {
  const { data, error } = await supabase
    .from("business_subscriptions")
    .select("business_id, id, provider_status, provider_subscription_id")
    .eq("provider", "mercadopago")
    .eq("provider_subscription_id", providerSubscriptionId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos consultar la suscripcion guardada.");
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
    .select("business_id, id, provider_status, provider_subscription_id")
    .eq("business_id", businessId)
    .eq("provider", "mercadopago")
    .eq("provider_plan_id", planId)
    .is("provider_subscription_id", null)
    .eq("provider_status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos consultar el intento de suscripcion.");
  }

  return data as StoredBusinessSubscription | null;
}

async function updateBusinessSubscriptionTier(businessId: string, mercadoPagoStatus?: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      subscription_tier: mapMercadoPagoStatusToTier(mercadoPagoStatus)
    })
    .eq("id", businessId);

  if (error) {
    throw new Error("No pudimos actualizar el plan del negocio.");
  }
}

async function resolveBusinessIdForSubscription(supabase: SupabaseClient, subscription: MercadoPagoSubscription) {
  const externalBusinessId = extractBusinessIdFromExternalReference(subscription.external_reference);

  if (externalBusinessId) {
    return externalBusinessId;
  }

  const config = getSubscriptionConfig();
  const storedSubscription = subscription.id
    ? await findStoredBusinessSubscriptionByProviderId(supabase, subscription.id)
    : null;

  if (storedSubscription?.business_id) {
    return storedSubscription.business_id;
  }

  if (subscription.preapproval_plan_id && subscription.preapproval_plan_id !== config.planCode) {
    return null;
  }

  const uniquePendingBusinessId = await resolveUniqueRecentPendingBusinessId(config.planCode);

  if (uniquePendingBusinessId) {
    return uniquePendingBusinessId;
  }

  if (!subscription.payer_email) {
    return null;
  }

  const user = await findUserByEmail(supabase, subscription.payer_email);

  if (!user?.id) {
    return null;
  }

  const { data: ownerMembership, error: ownerMembershipError } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (ownerMembershipError) {
    throw new Error("No pudimos encontrar el negocio asociado a la suscripcion.");
  }

  if (ownerMembership?.business_id) {
    return ownerMembership.business_id as string;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error("No pudimos encontrar el negocio asociado a la suscripcion.");
  }

  return membership?.business_id as string | null ?? null;
}

async function resolveUniqueRecentPendingBusinessId(planId: string) {
  const supabase = getSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString();
  const { data, error } = await supabase
    .from("business_subscriptions")
    .select("business_id")
    .eq("provider", "mercadopago")
    .eq("provider_plan_id", planId)
    .eq("provider_status", "pending")
    .is("provider_subscription_id", null)
    .gte("created_at", cutoff)
    .limit(2);

  if (error) {
    throw new Error("No pudimos resolver el intento pendiente de suscripcion.");
  }

  if (data.length !== 1) {
    return null;
  }

  return data[0]?.business_id as string | null ?? null;
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

async function findUserByEmail(supabase: SupabaseClient, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 1000;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      throw new Error("No pudimos validar el usuario asociado a la suscripcion.");
    }

    const user = data.users.find((candidate: User) => candidate.email?.trim().toLowerCase() === normalizedEmail);

    if (user) {
      return user;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }

  return null;
}

function isCancelledSubscriptionStatus(status?: string) {
  return status === "cancelled" || status === "canceled";
}

function getSubscriptionConfig() {
  const accessToken = process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    throw new Error("Configura MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN para habilitar las suscripciones.");
  }

  const transactionAmount = Number(process.env.MERCADO_PAGO_PRO_PRICE_ARS?.trim() || "25000");
  const frequency = Number(process.env.MERCADO_PAGO_PRO_FREQUENCY?.trim() || `${defaultFrequency}`);
  const frequencyType = process.env.MERCADO_PAGO_PRO_FREQUENCY_TYPE?.trim() || defaultFrequencyType;
  const webhookToken = process.env.MP_WEBHOOK_TOKEN?.trim() || "";
  const testPayerEmail = process.env.MERCADO_PAGO_TEST_PAYER_EMAIL?.trim() || "";

  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    throw new Error("Configura un precio valido en MERCADO_PAGO_PRO_PRICE_ARS para crear suscripciones.");
  }

  return {
    accessToken,
    frequency,
    frequencyType,
    planCode: proPlanCode,
    testPayerEmail,
    transactionAmount,
    webhookToken
  };
}
