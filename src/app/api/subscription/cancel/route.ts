import { NextRequest, NextResponse } from "next/server";

import { cancelLatestBusinessSubscription } from "@/lib/mercadopago/subscriptions";
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

    const result = await cancelLatestBusinessSubscription({
      businessId: body.businessId,
      payerEmail: authResult.user.email ?? ""
    });

    return NextResponse.json({
      status: result.status,
      subscriptionTier: result.subscriptionTier
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pudimos cancelar la suscripcion." },
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

  const { data: membership, error: membershipError } = await supabase
    .from("business_memberships")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

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

  return { user };
}
