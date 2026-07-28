import { NextRequest, NextResponse } from "next/server";

import { syncSubscriptionTierByPreapprovalId } from "@/lib/mercadopago/subscriptions";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

type SubscriptionWebhookPayload = {
  action?: string;
  data?: {
    id?: string;
  };
  id?: string | number;
  topic?: string;
  type?: string;
};

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const configuredToken = process.env.MP_WEBHOOK_TOKEN?.trim();
  const requestToken = request.nextUrl.searchParams.get("token")?.trim();

  if (configuredToken && requestToken !== configuredToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as SubscriptionWebhookPayload | null;
  const type = payload?.type ?? payload?.topic ?? request.nextUrl.searchParams.get("type") ?? request.nextUrl.searchParams.get("topic");
  const preapprovalId =
    payload?.data?.id ??
    (payload?.id === undefined ? null : String(payload.id)) ??
    request.nextUrl.searchParams.get("data.id") ??
    request.nextUrl.searchParams.get("preapproval_id") ??
    request.nextUrl.searchParams.get("id");

  await persistWebhookEvent({
    action: payload?.action ?? null,
    payload,
    preapprovalId,
    type
  });

  if (!preapprovalId || (type && !isPreapprovalEvent(type))) {
    return NextResponse.json({ ok: true });
  }

  await syncSubscriptionTierByPreapprovalId(preapprovalId).catch(() => null);

  return NextResponse.json({ ok: true });
}

async function persistWebhookEvent({
  action,
  payload,
  preapprovalId,
  type
}: {
  action: string | null;
  payload: SubscriptionWebhookPayload | null;
  preapprovalId?: string | null;
  type: string | null;
}) {
  const supabase = getSupabaseAdminClient();

  await supabase
    .from("mercadopago_webhook_events")
    .insert({
      action,
      event_type: type,
      payload,
      provider_subscription_id: preapprovalId ?? null
    })
    .then(() => null, () => null);
}

function isPreapprovalEvent(type: string) {
  const normalizedType = type.toLowerCase();

  return normalizedType.includes("preapproval") || normalizedType.includes("subscription");
}
