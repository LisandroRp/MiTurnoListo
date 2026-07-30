import { NextRequest, NextResponse } from "next/server";

import { isFreePlan } from "@/features/scheduling/plan-limits";
import { BusinessPaymentSettings } from "@/features/scheduling/types";
import { createApiErrorResponse } from "@/lib/networking/api-errors";
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
    .select("allow_mercadopago, mercadopago_public_key, transfer_account_holder, transfer_cbu, transfer_alias, transfer_receipt_whatsapp")
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return createApiErrorResponse(error, {
      code: "PAYMENT_SETTINGS_LOAD_FAILED",
      fallbackMessage: "Unable to load payment settings.",
      status: 500
    });
  }

  return NextResponse.json(mapPaymentSettings(data));
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    businessId?: string;
    settings?: BusinessPaymentSettings;
  } | null;

  if (!body?.businessId || !body.settings) {
    return NextResponse.json({ error: "Missing payload." }, { status: 400 });
  }

  const authResult = await authenticateRequest(request, body.businessId, {
    allowedRoles: ["owner", "admin"]
  });

  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = getSupabaseAdminClient();
  const tierResult = await getSubscriptionTier(supabase, body.businessId);

  if ("response" in tierResult) {
    return tierResult.response;
  }

  if (isFreePlan(tierResult.subscriptionTier)) {
    return NextResponse.json(
      { error: "El plan Free no permite configurar metodos de pago." },
      { status: 402 }
    );
  }

  const { data: currentSettings } = await supabase
    .from("business_payment_settings")
    .select("mercadopago_access_token")
    .eq("business_id", body.businessId)
    .limit(1)
    .maybeSingle();

  const nextAccessToken = normalizeMercadoPagoCredential(body.settings.mercadoPago.accessToken) || currentSettings?.mercadopago_access_token || null;
  const nextTransfers = {
    accountHolder: normalizeTransferValue(body.settings.transfers.accountHolder),
    cbu: normalizeTransferValue(body.settings.transfers.cbu),
    alias: normalizeTransferValue(body.settings.transfers.alias),
    receiptWhatsapp: normalizeTransferValue(body.settings.transfers.receiptWhatsapp)
  };
  const hasTransferSettings = Boolean(
    nextTransfers.accountHolder ||
    nextTransfers.cbu ||
    nextTransfers.alias ||
    nextTransfers.receiptWhatsapp
  );

  if (hasTransferSettings && !nextTransfers.receiptWhatsapp) {
    return NextResponse.json(
      { error: "Carga un WhatsApp para poder guardar transferencias." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("business_payment_settings")
    .upsert({
      business_id: body.businessId,
      allow_cash: true,
      allow_transfer: Boolean(
        nextTransfers.accountHolder &&
        nextTransfers.cbu &&
        nextTransfers.alias &&
        nextTransfers.receiptWhatsapp
      ),
      allow_mercadopago: Boolean((nextAccessToken ?? "").trim()),
      transfer_account_holder: nextTransfers.accountHolder || null,
      transfer_cbu: nextTransfers.cbu || null,
      transfer_alias: nextTransfers.alias || null,
      transfer_receipt_whatsapp: nextTransfers.receiptWhatsapp || null,
      mercadopago_public_key: null,
      mercadopago_access_token: nextAccessToken
    });

  if (error) {
    return createApiErrorResponse(error, {
      code: "PAYMENT_SETTINGS_SAVE_FAILED",
      fallbackMessage: "Unable to save payment settings.",
      status: 500
    });
  }

  return NextResponse.json({
    mercadoPago: {
      accessToken: "",
      publicKey: "",
      isConfigured: Boolean((nextAccessToken ?? "").trim())
    },
    transfers: nextTransfers
  } satisfies BusinessPaymentSettings);
}

function normalizeMercadoPagoCredential(value: string) {
  const trimmedValue = value.trim();

  if (
    trimmedValue === "APP_USR-XXXXXXXXXXXXXXXXXXXX" ||
    trimmedValue === "APP_USR-00000000-0000-0000-0000-000000000000"
  ) {
    return "";
  }

  return trimmedValue;
}

function normalizeTransferValue(value: string) {
  const trimmedValue = value.trim();

  if (
    trimmedValue === "Nombre del Titular" ||
    trimmedValue === "Account holder name" ||
    trimmedValue === "Introducir CBU (22 digitos)" ||
    trimmedValue === "Enter CBU (22 digits)" ||
    trimmedValue === "Introducir alias de la cuenta" ||
    trimmedValue === "Enter account alias" ||
    trimmedValue === "WhatsApp para comprobantes" ||
    trimmedValue === "Receipt WhatsApp"
  ) {
    return "";
  }

  return trimmedValue;
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

async function getSubscriptionTier(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  businessId: string
) {
  const { data, error } = await supabase
    .from("businesses")
    .select("subscription_tier")
    .eq("id", businessId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      response: NextResponse.json({ error: "Business not found." }, { status: 404 })
    };
  }

  return {
    subscriptionTier: data.subscription_tier as string
  };
}
