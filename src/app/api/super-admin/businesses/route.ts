import { NextRequest, NextResponse } from "next/server";

import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

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
  provider_status: string | null;
  provider_subscription_id: string | null;
  subscription_tier: string | null;
};

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
    serviceResult,
    employeeResult,
    appointmentResult
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
      .select("business_id, provider_status, provider_subscription_id, subscription_tier"),
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
      .lt("starts_at", monthRange.end)
  ]);

  if (businessResult.error || membershipResult.error || subscriptionResult.error || serviceResult.error || employeeResult.error || appointmentResult.error) {
    throw businessResult.error ?? membershipResult.error ?? subscriptionResult.error ?? serviceResult.error ?? employeeResult.error ?? appointmentResult.error;
  }

  const businesses = (businessResult.data ?? []) as BusinessRow[];
  const owners = await loadOwnerAccounts(supabase, (membershipResult.data ?? []) as BusinessMembershipRow[]);
  const subscriptionsByBusinessId = getFirstByBusinessId((subscriptionResult.data ?? []) as BusinessSubscriptionRow[]);
  const serviceCounts = countByBusinessId((serviceResult.data ?? []) as CountRow[]);
  const employeeCounts = countByBusinessId((employeeResult.data ?? []) as CountRow[]);
  const monthlyAppointments = aggregateAppointmentsByBusinessId((appointmentResult.data ?? []) as AppointmentRow[]);

  return businesses.map((business) => {
    const subscription = subscriptionsByBusinessId.get(business.id);
    const appointments = monthlyAppointments.get(business.id);

    return {
      businessId: business.id,
      businessName: business.name ?? "Sin nombre",
      employeeCount: employeeCounts.get(business.id) ?? 0,
      monthlyAppointmentCount: appointments?.count ?? 0,
      monthlyCancelledCount: appointments?.cancelledCount ?? 0,
      monthlyRevenue: appointments?.revenue ?? 0,
      ownerCreatedAt: owners.get(business.id)?.createdAt ?? "",
      ownerEmail: owners.get(business.id)?.email ?? "-",
      ownerEmailVerified: owners.get(business.id)?.isEmailVerified ?? false,
      ownerLastSignInAt: owners.get(business.id)?.lastSignInAt ?? "",
      ownerProvider: owners.get(business.id)?.provider ?? "-",
      plan: business.subscription_tier ?? "free",
      providerStatus: subscription?.provider_status ?? "manual",
      providerSubscriptionId: subscription?.provider_subscription_id ?? "",
      serviceCount: serviceCounts.get(business.id) ?? 0,
      subscriptionTier: subscription?.subscription_tier ?? business.subscription_tier ?? "free"
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
        provider: getUserProvider(user.app_metadata)
      });
    }
  }));

  return ownerAccountByBusinessId;
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
