import { NextRequest, NextResponse } from "next/server";

import { createProSubscriptionCheckout, syncLatestBusinessSubscription } from "@/lib/mercadopago/subscriptions";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as {
      businessId?: string;
    } | null;

    if (!body?.businessId) {
      return NextResponse.json({ error: "Missing businessId." }, { status: 400 });
    }

    const authResult = await authenticateBusinessRequest(request, body.businessId, ["owner", "admin"]);

    if ("response" in authResult) {
      return authResult.response;
    }

    const currentStatus = await syncLatestBusinessSubscription({
      businessId: body.businessId,
      payerEmail: authResult.user.email ?? ""
    });

    if (currentStatus.subscriptionTier === "pro") {
      return NextResponse.json({
        checkoutUrl: "/perfil",
        status: currentStatus.status,
        subscriptionTier: "pro"
      });
    }

    const checkout = await createProSubscriptionCheckout({
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pudimos iniciar la suscripcion al plan Pro." },
      { status: 502 }
    );
  }
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
