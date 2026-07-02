import { NextRequest, NextResponse } from "next/server";

import { BusinessPaymentSettings } from "@/features/scheduling/types";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { mapPaymentSettings } from "@/lib/networking/mappers/scheduling";

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get("businessId");

  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId." }, { status: 400 });
  }

  const authResult = await authenticateRequest(request, businessId);

  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("business_payment_settings")
    .select("allow_mercadopago, mercadopago_public_key, transfer_account_holder, transfer_cbu, transfer_alias")
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Unable to load payment settings." }, { status: 500 });
  }

  return NextResponse.json(mapPaymentSettings(data));
}

export async function PUT(request: NextRequest) {
  const body = await request.json() as {
    businessId?: string;
    settings?: BusinessPaymentSettings;
  };

  if (!body.businessId || !body.settings) {
    return NextResponse.json({ error: "Missing payload." }, { status: 400 });
  }

  const authResult = await authenticateRequest(request, body.businessId, {
    allowedRoles: ["owner", "admin"]
  });

  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = getSupabaseAdminClient();
  const { data: currentSettings } = await supabase
    .from("business_payment_settings")
    .select("mercadopago_access_token")
    .eq("business_id", body.businessId)
    .limit(1)
    .maybeSingle();

  const nextAccessToken = body.settings.mercadoPago.accessToken.trim() || currentSettings?.mercadopago_access_token || null;

  const { error } = await supabase
    .from("business_payment_settings")
    .upsert({
      business_id: body.businessId,
      allow_cash: true,
      allow_transfer: Boolean(
        body.settings.transfers.accountHolder.trim() &&
        body.settings.transfers.cbu.trim() &&
        body.settings.transfers.alias.trim()
      ),
      allow_mercadopago: Boolean(
        body.settings.mercadoPago.publicKey.trim() &&
        (nextAccessToken ?? "").trim()
      ),
      transfer_account_holder: body.settings.transfers.accountHolder || null,
      transfer_cbu: body.settings.transfers.cbu || null,
      transfer_alias: body.settings.transfers.alias || null,
      mercadopago_public_key: body.settings.mercadoPago.publicKey || null,
      mercadopago_access_token: nextAccessToken
    });

  if (error) {
    return NextResponse.json({ error: "Unable to save payment settings." }, { status: 500 });
  }

  return NextResponse.json({
    mercadoPago: {
      accessToken: "",
      publicKey: body.settings.mercadoPago.publicKey,
      isConfigured: Boolean(body.settings.mercadoPago.publicKey.trim() && (nextAccessToken ?? "").trim())
    },
    transfers: body.settings.transfers
  } satisfies BusinessPaymentSettings);
}

async function authenticateRequest(
  request: NextRequest,
  businessId: string,
  options: {
    allowedRoles?: string[];
  } = {}
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

  if (options.allowedRoles && !options.allowedRoles.includes(membership.role)) {
    return {
      response: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 })
    };
  }

  return { userId: user.id };
}
