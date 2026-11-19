import { areNewSubscriptionPlansEnabled, isPaidSubscriptionTier } from "@/lib/subscription-plans";

import { NextRequest, NextResponse } from "next/server";

import { changeBusinessSubscriptionPlan, createProSubscriptionCheckout, syncLatestBusinessSubscription } from "@/lib/mercadopago/subscriptions";
import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as {
      businessId?: string;
      plan?: unknown;
    } | null;

    if (!body?.businessId) {
      return NextResponse.json({ error: "Missing businessId." }, { status: 400 });
    }

    const plan = body.plan ?? "pro";
    if (!isPaidSubscriptionTier(plan)) return NextResponse.json({ error: "Invalid subscription plan." }, { status: 400 });
    if (plan === "unlimited" && !areNewSubscriptionPlansEnabled()) return NextResponse.json({ error: "El plan Ilimitado todavía no está disponible." }, { status: 409 });

    const authResult = await authenticateBusinessRequest(request, body.businessId, ["owner", "admin"]);

    if ("response" in authResult) {
      return authResult.response;
    }

    const currentStatus = await syncLatestBusinessSubscription({
      businessId: body.businessId,
      payerEmail: authResult.user.email ?? ""
    });

    if (isPaidSubscriptionTier(currentStatus.subscriptionTier) && currentStatus.subscriptionTier !== plan && currentStatus.preapprovalId) {
      const changed = await changeBusinessSubscriptionPlan({ businessId: body.businessId, preapprovalId: currentStatus.preapprovalId, plan });
      return NextResponse.json({ checkoutUrl: "/perfil", purchase: null, status: changed.status, subscriptionTier: changed.subscriptionTier });
    }

    if (currentStatus.subscriptionTier === plan) {
      return NextResponse.json({
        checkoutUrl: "/perfil",
        purchase: await getLatestApprovedSubscriptionPurchase(body.businessId),
        status: currentStatus.status,
        subscriptionTier: currentStatus.subscriptionTier
      });
    }

    const checkout = await createProSubscriptionCheckout({
      plan,
      businessId: body.businessId,
      payerEmail: authResult.user.email ?? "",
      requestOrigin: request.nextUrl.origin,
      userId: authResult.user.id
    });

    return NextResponse.json({
      checkoutUrl: checkout.checkoutUrl,
      status: checkout.status,
      subscriptionTier: "free"
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      code: "SUBSCRIPTION_CHECKOUT_FAILED",
      fallbackMessage: "No pudimos iniciar la suscripción al plan PRO.",
      status: 502
    });
  }
}

async function getLatestApprovedSubscriptionPurchase(businessId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_subscription_payments")
    .select("amount, currency, provider_payment_id")
    .eq("business_id", businessId)
    .eq("provider", "mercadopago")
    .eq("provider_status", "approved")
    .order("paid_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.provider_payment_id) {
    return null;
  }

  return {
    amount: Number(data.amount ?? 0),
    currency: data.currency ?? "ARS",
    paymentId: String(data.provider_payment_id)
  };
}

async function authenticateBusinessRequest(
  request: NextRequest,
  businessId: string,
  allowedRoles: string[]
) {
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

  if (authError || !user) {
    return {
      response: NextResponse.json({ error: "Invalid session." }, { status: 401 })
    };
  }

  const [{ data: membership, error: membershipError }, { data: business, error: businessError }] = await Promise.all([
    supabase
      .from("business_memberships")
      .select("role")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .limit(1)
      .maybeSingle()
  ]);

  if (membershipError || !membership) {
    return {
      response: NextResponse.json({ error: "Membership not found." }, { status: 403 })
    };
  }

  if (!allowedRoles.includes(membership.role)) {
    return {
      response: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 })
    };
  }

  if (businessError || !business) {
    return {
      response: NextResponse.json({ error: "Business not found." }, { status: 404 })
    };
  }

  return {
    businessName: business.name ?? "Negocio",
    user
  };
}
