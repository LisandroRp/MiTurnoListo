import { NextRequest, NextResponse } from "next/server";

import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import {
  aggregateSubscriptionPaymentsByBusinessId,
  aggregateSubscriptionRevenueByBusinessId,
  SubscriptionPaymentRevenueRow,
  SubscriptionRevenueRow
} from "@/lib/super-admin/subscription-revenue";

type SuperAdminAction = "activatePro" | "downgradeFree";

type SuperAdminMutationPayload = {
  action: SuperAdminAction;
  businessId: string;
};

type BusinessRow = {
  id: string;
  name: string | null;
  subscription_tier: string | null;
};

type BusinessSubscriptionRow = {
  business_id: string;
  cancelled_at: string | null;
  provider_status: string | null;
  provider_subscription_id: string | null;
  started_at: string | null;
  subscription_tier: string | null;
  updated_at: string | null;
} & SubscriptionRevenueRow;

type BusinessMembershipRow = {
  business_id: string;
  role: string | null;
  user_id: string;
};

type OwnerAccount = {
  createdAt: string;
  email: string;
  isEmailVerified: boolean;
  lastSignInAt: string;
  provider: string;
  userId: string;
};

type CountRow = {
  business_id: string;
  id: string;
};

type AppointmentRow = {
  business_id: string;
  id: string;
  status: string | null;
  total_amount: number | string | null;
};

type UserProfileReferralRow = {
  id: string;
  referral_attribution_code: string | null;
  referral_code: string | null;
};

type ReferralRow = {
  referred_user_id: string;
  referrer_user_id: string;
  status: string;
};

type ReferralRewardRow = {
  days_remaining: number | string | null;
  expires_at: string | null;
  status: string;
  user_id: string;
};

type AuthenticatedSuperAdmin = {
  email: string;
  userId: string;
};

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  const authResult = await authenticateSuperAdmin(request);

  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const businesses = await loadSuperAdminBusinesses(supabase);

    return NextResponse.json({
      data: businesses
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      code: "SUPER_ADMIN_BUSINESSES_LOAD_FAILED",
      fallbackMessage: "Unable to load super admin businesses.",
      status: 500
    });
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  const authResult = await authenticateSuperAdmin(request);

  if ("response" in authResult) {
    return authResult.response;
  }

  const payload = await request.json().catch(() => null) as SuperAdminMutationPayload | null;

  if (!payload?.businessId || !isSuperAdminAction(payload.action)) {
    return NextResponse.json({ error: "Invalid super admin action." }, { status: 400 });
  }

  const nextTier = payload.action === "activatePro" ? "pro" : "free";
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name, subscription_tier")
    .eq("id", payload.businessId)
    .limit(1)
    .maybeSingle();

  if (businessError || !business) {
    return createApiErrorResponse(businessError ?? new Error("Business not found."), {
      code: "SUPER_ADMIN_BUSINESS_NOT_FOUND",
      fallbackMessage: "Unable to find the business.",
      status: businessError ? 500 : 404
    });
  }

  const previousTier = (business.subscription_tier ?? "free") as string;
  const { error: updateError } = await supabase
    .from("businesses")
    .update({ subscription_tier: nextTier })
    .eq("id", payload.businessId);

  if (updateError) {
    return createApiErrorResponse(updateError, {
      code: "SUPER_ADMIN_BUSINESS_UPDATE_FAILED",
      fallbackMessage: "Unable to update the business plan.",
      status: 500
    });
  }

  const { error: auditError } = await supabase
    .from("admin_audit_logs")
    .insert({
      action: payload.action,
      actor_email: authResult.admin.email,
      actor_user_id: authResult.admin.userId,
      previous_value: {
        subscriptionTier: previousTier
      },
      next_value: {
        subscriptionTier: nextTier
      },
      target_business_id: payload.businessId
    });

  if (auditError) {
    return createApiErrorResponse(auditError, {
      code: "SUPER_ADMIN_AUDIT_LOG_FAILED",
      fallbackMessage: "The plan was updated, but the audit log could not be saved.",
      status: 500
    });
  }

  return NextResponse.json({
    ok: true
  });
}

async function authenticateSuperAdmin(request: NextRequest): Promise<
  | { admin: AuthenticatedSuperAdmin }
  | { response: NextResponse }
> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return {
      response: NextResponse.json({ error: "Missing authorization token." }, { status: 401 })
    };
  }

  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(token);

  if (authError || !user?.id || !user.email) {
    return {
      response: NextResponse.json({ error: "Invalid session." }, { status: 401 })
    };
  }

  const { data: superAdmin, error: superAdminError } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (superAdminError) {
    return {
      response: createApiErrorResponse(superAdminError, {
        code: "SUPER_ADMIN_CHECK_FAILED",
        fallbackMessage: "Unable to validate super admin permissions.",
        status: 500
      })
    };
  }

  if (!superAdmin) {
    return {
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 })
    };
  }

  return {
    admin: {
      email: user.email,
      userId: user.id
    }
  };
}

async function loadSuperAdminBusinesses(supabase: ReturnType<typeof getSupabaseAdminClient>) {
  const monthRange = getCurrentMonthRange();
  const [
    businessResult,
    membershipResult,
    subscriptionResult,
    subscriptionPaymentResult,
    serviceResult,
    employeeResult,
    appointmentResult,
    profileReferralResult,
    referralResult,
    referralRewardResult
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, subscription_tier")
      .order("name", { ascending: true }),
    supabase
      .from("business_memberships")
      .select("business_id, user_id, role")
      .eq("role", "owner"),
    supabase
      .from("business_subscriptions")
      .select("business_id, cancelled_at, provider_status, provider_subscription_id, started_at, subscription_tier, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("business_subscription_payments")
      .select("business_id, provider_status, amount, paid_at"),
    supabase
      .from("services")
      .select("business_id, id"),
    supabase
      .from("employees")
      .select("business_id, id"),
    supabase
      .from("appointments")
      .select("business_id, id, status, total_amount")
      .gte("starts_at", monthRange.start)
      .lt("starts_at", monthRange.end),
    supabase
      .from("user_profiles")
      .select("id, referral_code, referral_attribution_code"),
    supabase
      .from("referrals")
      .select("referrer_user_id, referred_user_id, status"),
    supabase
      .from("referral_rewards")
      .select("user_id, days_remaining, expires_at, status")
  ]);

  if (businessResult.error || membershipResult.error || subscriptionResult.error || subscriptionPaymentResult.error || serviceResult.error || employeeResult.error || appointmentResult.error || profileReferralResult.error || referralResult.error || referralRewardResult.error) {
    throw businessResult.error ?? membershipResult.error ?? subscriptionResult.error ?? subscriptionPaymentResult.error ?? serviceResult.error ?? employeeResult.error ?? appointmentResult.error ?? profileReferralResult.error ?? referralResult.error ?? referralRewardResult.error;
  }

  const businesses = (businessResult.data ?? []) as BusinessRow[];
  const owners = await loadOwnerAccounts(supabase, (membershipResult.data ?? []) as BusinessMembershipRow[]);
  const subscriptions = (subscriptionResult.data ?? []) as BusinessSubscriptionRow[];
  const subscriptionsByBusinessId = getFirstByBusinessId(subscriptions);
  const subscriptionRevenueByBusinessId = aggregateSubscriptionRevenueByBusinessId({
    monthRange,
    proPrice: getProSubscriptionPrice(),
    rows: subscriptions
  });
  const subscriptionPaymentsByBusinessId = aggregateSubscriptionPaymentsByBusinessId({
    monthRange,
    rows: (subscriptionPaymentResult.data ?? []) as SubscriptionPaymentRevenueRow[]
  });
  const serviceCounts = countByBusinessId((serviceResult.data ?? []) as CountRow[]);
  const employeeCounts = countByBusinessId((employeeResult.data ?? []) as CountRow[]);
  const monthlyAppointments = aggregateAppointmentsByBusinessId((appointmentResult.data ?? []) as AppointmentRow[]);
  const profileReferralsByUserId = getProfileReferralsByUserId((profileReferralResult.data ?? []) as UserProfileReferralRow[]);
  const referralStatsByUserId = aggregateReferralStatsByUserId((referralResult.data ?? []) as ReferralRow[]);
  const rewardStatsByUserId = aggregateReferralRewardStatsByUserId((referralRewardResult.data ?? []) as ReferralRewardRow[]);

  return businesses.map((business) => {
    const subscription = subscriptionsByBusinessId.get(business.id);
    const realSubscriptionRevenue = subscriptionPaymentsByBusinessId.get(business.id);
    const estimatedSubscriptionRevenue = subscriptionRevenueByBusinessId.get(business.id);
    const subscriptionRevenue = realSubscriptionRevenue?.totalPaidCount || realSubscriptionRevenue?.monthlyPaidCount
      ? realSubscriptionRevenue
      : estimatedSubscriptionRevenue;
    const appointments = monthlyAppointments.get(business.id);
    const owner = owners.get(business.id);
    const profileReferral = owner?.userId ? profileReferralsByUserId.get(owner.userId) : null;
    const referralStats = owner?.userId ? referralStatsByUserId.get(owner.userId) : null;
    const rewardStats = owner?.userId ? rewardStatsByUserId.get(owner.userId) : null;
    const hasAuthorizedSubscription = subscription?.provider_status === "authorized";
    const isReferralPro = business.subscription_tier === "pro" && !hasAuthorizedSubscription && Boolean(rewardStats?.activeDaysRemaining);

    return {
      businessId: business.id,
      businessName: business.name ?? "Sin nombre",
      employeeCount: employeeCounts.get(business.id) ?? 0,
      isReferralPro,
      monthlyAppointmentCount: appointments?.count ?? 0,
      monthlyCancelledCount: appointments?.cancelledCount ?? 0,
      monthlyPaidSubscriptionCount: subscriptionRevenue?.monthlyPaidCount ?? 0,
      monthlySubscriptionRevenue: subscriptionRevenue?.monthlyRevenue ?? 0,
      ownerCreatedAt: owner?.createdAt ?? "",
      ownerEmail: owner?.email ?? "-",
      ownerEmailVerified: owner?.isEmailVerified ?? false,
      ownerLastSignInAt: owner?.lastSignInAt ?? "",
      ownerProvider: owner?.provider ?? "-",
      plan: business.subscription_tier ?? "free",
      providerStatus: subscription?.provider_status ?? "manual",
      providerSubscriptionId: subscription?.provider_subscription_id ?? "",
      referralActiveDaysRemaining: rewardStats?.activeDaysRemaining ?? 0,
      referralAvailableMonths: rewardStats?.availableMonths ?? 0,
      referralCode: profileReferral?.referral_code ?? "",
      referralPremiumCount: referralStats?.premiumCount ?? 0,
      referralRegisteredCount: referralStats?.registeredCount ?? 0,
      referredByCode: profileReferral?.referral_attribution_code ?? "",
      serviceCount: serviceCounts.get(business.id) ?? 0,
      subscriptionTier: subscription?.subscription_tier ?? business.subscription_tier ?? "free",
      totalPaidSubscriptionCount: subscriptionRevenue?.totalPaidCount ?? 0,
      totalSubscriptionRevenue: subscriptionRevenue?.totalRevenue ?? 0
    };
  });
}

async function loadOwnerAccounts(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  memberships: BusinessMembershipRow[]
) {
  const ownerAccountByBusinessId = new Map<string, OwnerAccount>();

  await Promise.all(memberships.map(async (membership) => {
    const { data } = await supabase.auth.admin.getUserById(membership.user_id);
    const user = data.user;

    if (user?.email) {
      ownerAccountByBusinessId.set(membership.business_id, {
        createdAt: user.created_at ?? "",
        email: user.email,
        isEmailVerified: Boolean(user.email_confirmed_at),
        lastSignInAt: user.last_sign_in_at ?? "",
        provider: getUserProvider(user.app_metadata),
        userId: membership.user_id
      });
    }
  }));

  return ownerAccountByBusinessId;
}

function getProfileReferralsByUserId(rows: UserProfileReferralRow[]) {
  return rows.reduce<Map<string, UserProfileReferralRow>>((accumulator, row) => {
    accumulator.set(row.id, row);

    return accumulator;
  }, new Map());
}

function aggregateReferralStatsByUserId(rows: ReferralRow[]) {
  return rows.reduce<Map<string, { premiumCount: number; registeredCount: number }>>((accumulator, row) => {
    const current = accumulator.get(row.referrer_user_id) ?? {
      premiumCount: 0,
      registeredCount: 0
    };

    accumulator.set(row.referrer_user_id, {
      premiumCount: current.premiumCount + (row.status === "rewarded" || row.status === "capped" ? 1 : 0),
      registeredCount: current.registeredCount + 1
    });

    return accumulator;
  }, new Map());
}

function aggregateReferralRewardStatsByUserId(rows: ReferralRewardRow[]) {
  return rows.reduce<Map<string, { activeDaysRemaining: number; availableMonths: number }>>((accumulator, row) => {
    const current = accumulator.get(row.user_id) ?? {
      activeDaysRemaining: 0,
      availableMonths: 0
    };
    const daysRemaining = Number(row.days_remaining ?? 0);
    const activeDaysRemaining = row.status === "active" && row.expires_at
      ? Math.max(0, Math.ceil((Date.parse(row.expires_at) - Date.now()) / 86400000))
      : 0;

    accumulator.set(row.user_id, {
      activeDaysRemaining: Math.max(current.activeDaysRemaining, activeDaysRemaining),
      availableMonths: current.availableMonths + (row.status === "available" ? Math.floor(daysRemaining / 30) : 0)
    });

    return accumulator;
  }, new Map());
}

function getUserProvider(appMetadata: unknown) {
  if (!appMetadata || typeof appMetadata !== "object" || Array.isArray(appMetadata)) {
    return "-";
  }

  const metadata = appMetadata as Record<string, unknown>;
  const provider = metadata.provider;

  return typeof provider === "string" && provider.trim() ? provider : "-";
}

function countByBusinessId(rows: CountRow[]) {
  return rows.reduce<Map<string, number>>((accumulator, row) => {
    accumulator.set(row.business_id, (accumulator.get(row.business_id) ?? 0) + 1);

    return accumulator;
  }, new Map());
}

function aggregateAppointmentsByBusinessId(rows: AppointmentRow[]) {
  return rows.reduce<Map<string, { cancelledCount: number; count: number; revenue: number }>>((accumulator, row) => {
    const current = accumulator.get(row.business_id) ?? {
      cancelledCount: 0,
      count: 0,
      revenue: 0
    };

    accumulator.set(row.business_id, {
      cancelledCount: current.cancelledCount + (row.status === "cancelled" ? 1 : 0),
      count: current.count + 1,
      revenue: current.revenue + Number(row.total_amount ?? 0)
    });

    return accumulator;
  }, new Map());
}

function getFirstByBusinessId(rows: BusinessSubscriptionRow[]) {
  return rows.reduce<Map<string, BusinessSubscriptionRow>>((accumulator, row) => {
    if (!accumulator.has(row.business_id)) {
      accumulator.set(row.business_id, row);
    }

    return accumulator;
  }, new Map());
}

function getProSubscriptionPrice() {
  const price = Number(process.env.MERCADO_PAGO_PRO_PRICE_ARS?.trim() || "25000");

  return Number.isFinite(price) && price > 0 ? price : 25000;
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    end: end.toISOString(),
    start: start.toISOString()
  };
}

function isSuperAdminAction(value: unknown): value is SuperAdminAction {
  return value === "activatePro" || value === "downgradeFree";
}
