import { NextRequest, NextResponse } from "next/server";

import { confirmMercadoPagoAppointmentPayment } from "@/lib/mercadopago/checkout";

export async function POST(request: NextRequest) {
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
