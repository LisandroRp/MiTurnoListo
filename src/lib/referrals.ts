import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { normalizeReferralCode } from "@/lib/referral-rules";

export type ReferralSummary = {
  subscriptionAccessSource: "free" | "paid" | "referral";
  referralCode: string;
  referralLink: string;
  isProgramActive: boolean;
  registeredCount: number;
  premiumReferralCount: number;
  availableMonths: number;
  usedMonths: number;
  activeDaysRemaining: number;
};

type ReferralRewardRow = {
  days_granted: number;
  days_remaining: number;
  expires_at: string | null;
  status: string;
};

type ReferralRow = {
  id: string;
  referrer_user_id: string;
  status: string;
};

const referralRewardDays = 30;
const maxAvailableReferralMonths = 3;
const maxAvailableReferralDays = referralRewardDays * maxAvailableReferralMonths;
const referralCodePattern = /^[A-Z0-9]{4,24}$/;

export function isValidReferralCode(value: string | null | undefined) {
  return referralCodePattern.test(normalizeReferralCode(value));
}

export async function activateReferralProgramForUser({
  origin,
  supabase,
  user
}: {
  origin: string;
  supabase: SupabaseClient;
  user: User;
}) {
  const currentProfile = await getUserReferralProfile(supabase, user.id);

  if (currentProfile.referral_code) {
    return getReferralSummary({
      origin,
      supabase,
      userId: user.id
    });
  }

  const referralCode = await generateUniqueReferralCode({
    email: user.email ?? "",
    firstName: currentProfile.first_name,
    lastName: currentProfile.last_name,
    supabase
  });
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("user_profiles")
    .update({
      referral_code: referralCode,
      referral_program_activated_at: now
    })
    .eq("id", user.id);

  if (error) {
    throw new Error("No pudimos activar tu código de referidos.");
  }

  return getReferralSummary({
    origin,
    supabase,
    userId: user.id
  });
}

export async function attributeReferralForNewProfile({
  referralCode,
  referredUserId,
  supabase
}: {
  referralCode: string | null | undefined;
  referredUserId: string;
  supabase: SupabaseClient;
}) {
  const normalizedCode = normalizeReferralCode(referralCode);

  if (!isValidReferralCode(normalizedCode)) {
    return false;
  }

  const { data: referrerProfile, error: referrerError } = await supabase
    .from("user_profiles")
    .select("id, referral_code")
    .eq("referral_code", normalizedCode)
    .neq("id", referredUserId)
    .limit(1)
    .maybeSingle();

  if (referrerError || !referrerProfile?.id) {
    return false;
  }

  const now = new Date().toISOString();
  const { data: existingReferral, error: existingReferralError } = await supabase
    .from("referrals")
    .select("id")
    .eq("referred_user_id", referredUserId)
    .limit(1)
    .maybeSingle();

  if (existingReferralError || existingReferral?.id) {
    return false;
  }

  const [{ error: profileError }, { error: referralError }] = await Promise.all([
    supabase
      .from("user_profiles")
      .update({
        referred_by_user_id: referrerProfile.id,
        referral_attributed_at: now,
        referral_attribution_code: normalizedCode
      })
      .eq("id", referredUserId)
      .is("referred_by_user_id", null),
    supabase
      .from("referrals")
      .insert({
        referrer_user_id: referrerProfile.id,
        referred_user_id: referredUserId,
        referral_code: normalizedCode,
        status: "pending",
        signed_up_at: now,
        updated_at: now
      })
  ]);

  return !profileError && !referralError;
}

export async function rewardReferralForBusinessPayment({
  businessId,
  paymentId,
  paymentStatus,
  supabase
}: {
  businessId: string;
  paymentId: string;
  paymentStatus: string | undefined;
  supabase: SupabaseClient;
}) {
  if (paymentStatus !== "approved") {
    return false;
  }

  const ownerUserId = await findBusinessOwnerUserId(supabase, businessId);

  if (!ownerUserId) {
    return false;
  }

  const { data: referral, error: referralError } = await supabase
    .from("referrals")
    .select("id, referrer_user_id, status")
    .eq("referred_user_id", ownerUserId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle<ReferralRow>();

  if (referralError || !referral?.id) {
    return false;
  }

  const hasPreviousApprovedPayment = await hasPreviousApprovedSubscriptionPayment({
    businessId,
    paymentId,
    supabase
  });

  if (hasPreviousApprovedPayment) {
    return false;
  }

  const availableDays = await getAvailableReferralRewardDays(supabase, referral.referrer_user_id);
  const now = new Date().toISOString();

  if (availableDays >= maxAvailableReferralDays) {
    const { error } = await supabase
      .from("referrals")
      .update({
        qualifying_payment_id: paymentId,
        status: "capped",
        updated_at: now
      })
      .eq("id", referral.id)
      .eq("status", "pending");

    return !error;
  }

  const shouldActivateNow = await shouldActivateReferralRewardNow({
    supabase,
    userId: referral.referrer_user_id
  });
  const rewardPayload: Record<string, number | string | null> = shouldActivateNow
    ? {
        activated_at: now,
        days_granted: referralRewardDays,
        days_remaining: referralRewardDays,
        expires_at: addDaysIso(now, referralRewardDays),
        referral_id: referral.id,
        status: "active",
        updated_at: now,
        user_id: referral.referrer_user_id
      }
    : {
        activated_at: null,
        days_granted: referralRewardDays,
        days_remaining: referralRewardDays,
        expires_at: null,
        referral_id: referral.id,
        status: "available",
        updated_at: now,
        user_id: referral.referrer_user_id
      };
  const [{ error: rewardError }, { error: referralUpdateError }] = await Promise.all([
    supabase
      .from("referral_rewards")
      .insert(rewardPayload),
    supabase
      .from("referrals")
      .update({
        qualifying_payment_id: paymentId,
        rewarded_at: now,
        status: "rewarded",
        updated_at: now
      })
      .eq("id", referral.id)
      .eq("status", "pending")
  ]);

  if (rewardError || referralUpdateError) {
    return false;
  }

  if (shouldActivateNow) {
    await setUserBusinessTier({
      supabase,
      subscriptionTier: "pro",
      userId: referral.referrer_user_id
    });
  }

  return true;
}

export async function getReferralSummary({
  origin,
  supabase,
  userId
}: {
  origin: string;
  supabase: SupabaseClient;
  userId: string;
}): Promise<ReferralSummary> {
  await reconcileReferralAccessForUser({ supabase, userId });

  const [
    profileResult,
    registeredResult,
    premiumResult,
    rewardResult
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("referral_code, referral_program_activated_at")
      .eq("id", userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", userId),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_user_id", userId)
      .in("status", ["rewarded", "capped"]),
    supabase
      .from("referral_rewards")
      .select("days_granted, days_remaining, expires_at, status")
      .eq("user_id", userId)
      .in("status", ["available", "active", "used"])
  ]);

  const referralCode = normalizeReferralCode(profileResult.data?.referral_code);
  const rewardRows = (rewardResult.data ?? []) as ReferralRewardRow[];
  const availableDays = rewardRows
    .filter((reward) => reward.status === "available")
    .reduce((total, reward) => total + reward.days_remaining, 0);
  const usedDays = rewardRows
    .filter((reward) => reward.status === "used")
    .reduce((total, reward) => total + Number(reward.days_granted ?? referralRewardDays), 0);
  const activeDaysRemaining = getActiveReferralDaysRemaining(rewardRows);
  const [hasPaidSubscription, businessSubscriptionTier] = await Promise.all([
    hasActivePaidSubscription(supabase, userId),
    getUserBusinessSubscriptionTier(supabase, userId)
  ]);
  const subscriptionAccessSource = hasPaidSubscription
    ? "paid"
    : activeDaysRemaining > 0
      ? "referral"
      : businessSubscriptionTier === "pro"
        ? "paid"
      : "free";

  return {
    activeDaysRemaining,
    availableMonths: Math.floor(availableDays / referralRewardDays),
    isProgramActive: Boolean(profileResult.data?.referral_program_activated_at && referralCode),
    premiumReferralCount: premiumResult.count ?? 0,
    referralCode,
    referralLink: referralCode ? `${origin.replace(/\/+$/, "")}/login?mode=signup&ref=${encodeURIComponent(referralCode)}` : "",
    registeredCount: registeredResult.count ?? 0,
    subscriptionAccessSource,
    usedMonths: Math.floor(usedDays / referralRewardDays)
  };
}

export async function reconcileReferralAccessForUser({
  supabase,
  userId
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const activeReward = await findActiveReferralReward(supabase, userId);
  const hasPaidSubscription = await hasActivePaidSubscription(supabase, userId);

  if (hasPaidSubscription) {
    if (activeReward?.id) {
      await pauseActiveReferralReward({ reward: activeReward, supabase });
    }

    return;
  }

  if (activeReward?.id) {
    if (activeReward.expires_at && Date.parse(activeReward.expires_at) <= Date.now()) {
      await finishExpiredReferralReward({ rewardId: activeReward.id, supabase, userId });
      await activateNextAvailableReferralReward({ supabase, userId });
      return;
    }

    await setUserBusinessTier({
      supabase,
      subscriptionTier: "pro",
      userId
    });

    return;
  }

  await activateNextAvailableReferralReward({ supabase, userId });
}

export async function reconcileReferralAccessForBusiness({
  businessId,
  supabase
}: {
  businessId: string;
  supabase: SupabaseClient;
}) {
  const ownerUserId = await findBusinessOwnerUserId(supabase, businessId);

  if (!ownerUserId) {
    return;
  }

  await reconcileReferralAccessForUser({
    supabase,
    userId: ownerUserId
  });
}

async function activateNextAvailableReferralReward({
  supabase,
  userId
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data: reward, error } = await supabase
    .from("referral_rewards")
    .select("id, days_remaining")
    .eq("user_id", userId)
    .eq("status", "available")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; days_remaining: number }>();

  if (error || !reward?.id || reward.days_remaining <= 0) {
    return;
  }

  const now = new Date().toISOString();
  const { error: rewardError } = await supabase
    .from("referral_rewards")
    .update({
      activated_at: now,
      expires_at: addDaysIso(now, reward.days_remaining),
      status: "active",
      updated_at: now
    })
    .eq("id", reward.id);

  if (!rewardError) {
    await setUserBusinessTier({
      supabase,
      subscriptionTier: "pro",
      userId
    });
  }
}

async function finishExpiredReferralReward({
  rewardId,
  supabase,
  userId
}: {
  rewardId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const now = new Date().toISOString();
  await supabase
    .from("referral_rewards")
    .update({
      days_remaining: 0,
      status: "used",
      used_at: now,
      updated_at: now
    })
    .eq("id", rewardId);
  await setUserBusinessTier({
    supabase,
    subscriptionTier: "free",
    userId
  });
}

async function pauseActiveReferralReward({
  reward,
  supabase
}: {
  reward: { expires_at: string | null; id: string };
  supabase: SupabaseClient;
}) {
  const daysRemaining = reward.expires_at
    ? Math.max(1, Math.ceil((Date.parse(reward.expires_at) - Date.now()) / 86400000))
    : referralRewardDays;

  await supabase
    .from("referral_rewards")
    .update({
      days_remaining: daysRemaining,
      expires_at: null,
      status: "available",
      updated_at: new Date().toISOString()
    })
    .eq("id", reward.id);
}

async function findActiveReferralReward(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("referral_rewards")
    .select("id, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("activated_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ expires_at: string | null; id: string }>();

  if (error) {
    return null;
  }

  return data;
}

async function shouldActivateReferralRewardNow({
  supabase,
  userId
}: {
  supabase: SupabaseClient;
  userId: string;
}) {
  const [paidResult, activeRewardResult] = await Promise.all([
    hasActivePaidSubscription(supabase, userId),
    findActiveReferralReward(supabase, userId)
  ]);

  return !paidResult && !activeRewardResult?.id;
}

async function hasActivePaidSubscription(supabase: SupabaseClient, userId: string) {
  const { data: membership, error: membershipError } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<{ business_id: string }>();

  if (membershipError || !membership?.business_id) {
    return false;
  }

  const { data, error } = await supabase
    .from("business_subscriptions")
    .select("id")
    .eq("business_id", membership.business_id)
    .eq("provider", "mercadopago")
    .eq("subscription_tier", "pro")
    .eq("provider_status", "authorized")
    .limit(1)
    .maybeSingle();

  return !error && Boolean(data?.id);
}

async function getUserBusinessSubscriptionTier(supabase: SupabaseClient, userId: string) {
  const { data: membership, error: membershipError } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<{ business_id: string }>();

  if (membershipError || !membership?.business_id) {
    return "free";
  }

  const { data, error } = await supabase
    .from("businesses")
    .select("subscription_tier")
    .eq("id", membership.business_id)
    .limit(1)
    .maybeSingle<{ subscription_tier: "free" | "pro" }>();

  if (error) {
    return "free";
  }

  return data?.subscription_tier ?? "free";
}

async function getAvailableReferralRewardDays(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("referral_rewards")
    .select("days_remaining")
    .eq("user_id", userId)
    .eq("status", "available");

  if (error) {
    return 0;
  }

  return (data ?? []).reduce((total, reward) => total + Number(reward.days_remaining ?? 0), 0);
}

async function hasPreviousApprovedSubscriptionPayment({
  businessId,
  paymentId,
  supabase
}: {
  businessId: string;
  paymentId: string;
  supabase: SupabaseClient;
}) {
  const { count, error } = await supabase
    .from("business_subscription_payments")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("provider", "mercadopago")
    .eq("provider_status", "approved")
    .neq("provider_payment_id", paymentId);

  return !error && (count ?? 0) > 0;
}

async function findBusinessOwnerUserId(supabase: SupabaseClient, businessId: string) {
  const { data, error } = await supabase
    .from("business_memberships")
    .select("user_id")
    .eq("business_id", businessId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle<{ user_id: string }>();

  if (error) {
    return null;
  }

  return data?.user_id ?? null;
}

async function setUserBusinessTier({
  supabase,
  subscriptionTier,
  userId
}: {
  supabase: SupabaseClient;
  subscriptionTier: "free" | "pro";
  userId: string;
}) {
  const { data: membership } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<{ business_id: string }>();

  if (!membership?.business_id) {
    return;
  }

  await supabase
    .from("businesses")
    .update({ subscription_tier: subscriptionTier })
    .eq("id", membership.business_id);
}

async function getUserReferralProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("first_name, last_name, referral_code")
    .eq("id", userId)
    .limit(1)
    .maybeSingle<{ first_name: string; last_name: string; referral_code: string | null }>();

  if (error || !data) {
    throw new Error("No pudimos encontrar tu perfil.");
  }

  return data;
}

async function generateUniqueReferralCode({
  email,
  firstName,
  lastName,
  supabase
}: {
  email: string;
  firstName: string;
  lastName: string;
  supabase: SupabaseClient;
}) {
  const baseCode = buildReferralCodeBase(firstName, lastName, email);

  for (let index = 0; index < 20; index += 1) {
    const suffix = index === 0 ? "" : String(index + 1);
    const candidate = `${baseCode}${suffix}`.slice(0, 24);
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("referral_code", candidate)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error("No pudimos validar el código de referidos.");
    }

    if (!data) {
      return candidate;
    }
  }

  return `${baseCode.slice(0, 16)}${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function buildReferralCodeBase(firstName: string, lastName: string, email: string) {
  const source = `${firstName}${lastName}`.trim() || email.split("@")[0] || "AGENDA";
  const normalized = normalizeReferralCode(source);

  return normalized.length >= 4 ? normalized : `${normalized}AGENDA`.slice(0, 8);
}

function getActiveReferralDaysRemaining(rewardRows: ReferralRewardRow[]) {
  const activeReward = rewardRows.find((reward) => reward.status === "active");

  if (!activeReward?.expires_at) {
    return 0;
  }

  return Math.max(0, Math.ceil((Date.parse(activeReward.expires_at) - Date.now()) / 86400000));
}

function addDaysIso(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString();
}
