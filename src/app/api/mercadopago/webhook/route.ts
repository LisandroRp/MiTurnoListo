import { NextRequest, NextResponse } from "next/server";

import { confirmMercadoPagoAppointmentPayment } from "@/lib/mercadopago/checkout";

export async function POST(request: NextRequest) {
  const configuredToken = process.env.MP_WEBHOOK_TOKEN?.trim();
  const requestToken = request.nextUrl.searchParams.get("token")?.trim();

  if (configuredToken && requestToken !== configuredToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as {
    action?: string;
    data?: {
      id?: string;
    };
    type?: string;
  } | null;
  const paymentId = payload?.data?.id;

  if (!paymentId || (payload.type && payload.type !== "payment")) {
    return NextResponse.json({ ok: true });
  }

  const appointmentId = request.nextUrl.searchParams.get("appointmentId");

  if (!appointmentId) {
    return NextResponse.json({ ok: true });
  }

  await confirmMercadoPagoAppointmentPayment({ appointmentId, paymentId });

  return NextResponse.json({ ok: true });
}
