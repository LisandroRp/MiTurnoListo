import { NextRequest, NextResponse } from "next/server";

import { syncBusinessSubscriptionByPreapprovalId, syncLatestBusinessSubscription } from "@/lib/mercadopago/subscriptions";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get("businessId");
  const preapprovalId = request.nextUrl.searchParams.get("preapprovalId");

  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId." }, { status: 400 });
  }

  const authResult = await authenticateBusinessRequest(request, businessId);

  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const status = preapprovalId
      ? await syncBusinessSubscriptionByPreapprovalId({
          businessId,
          preapprovalId
        })
      : await syncLatestBusinessSubscription({
          businessId,
          payerEmail: authResult.user.email ?? ""
        });

    return NextResponse.json({
      status: status.status,
      subscriptionTier: status.subscriptionTier
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pudimos verificar el estado de la suscripcion." },
      { status: 502 }
    );
  }
}

async function authenticateBusinessRequest(request: NextRequest, businessId: string) {
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

  return { user };
}
