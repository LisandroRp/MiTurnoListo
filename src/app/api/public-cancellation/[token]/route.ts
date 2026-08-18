import { NextRequest, NextResponse } from "next/server";

import { sendBookingCancelledEmails } from "@/lib/email/booking-emails";
import { refundMercadoPagoPayment } from "@/lib/mercadopago/checkout";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type AppointmentCancellationRow = {
  id: string;
  business_id: string;
  employee_id: string;
  service_id: string;
  starts_at: string;
  status: string;
  total_amount: number;
  selected_payment_method: string | null;
  mercadopago_payment_id: string | null;
  refunded_at: string | null;
  customer_name_snapshot: string;
  customer_email_snapshot: string | null;
  customer_phone_snapshot: string | null;
};

export async function GET(_: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const details = await getCancellationDetails(token);

  if ("response" in details) {
    return details.response;
  }

  return NextResponse.json(details.payload);
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = await request.json().catch(() => null) as { cancellationReason?: unknown } | null;
    const normalizedCancellationReason = typeof body?.cancellationReason === "string" ? body.cancellationReason.trim() : "";
    const details = await getCancellationDetails(token);

    if ("response" in details) {
      return details.response;
    }

    if (details.payload.status === "cancelled") {
      return NextResponse.json({ ok: true, wasRefunded: Boolean(details.payload.refundedAt) });
    }

    if (!details.payload.canCancel) {
      return NextResponse.json({ error: details.payload.cannotCancelReason }, { status: 409 });
    }

    if (!normalizedCancellationReason) {
      return NextResponse.json({ error: "El motivo de cancelacion es obligatorio." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const shouldRefundMercadoPago = Boolean(
      details.appointment.selected_payment_method === "card" &&
      details.appointment.mercadopago_payment_id &&
      !details.appointment.refunded_at
    );
    const refundedAt = shouldRefundMercadoPago ? new Date().toISOString() : null;

    if (shouldRefundMercadoPago && details.appointment.mercadopago_payment_id) {
      await refundMercadoPagoPayment({
        businessId: details.appointment.business_id,
        paymentId: details.appointment.mercadopago_payment_id
      });
    }

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        cancellation_reason: normalizedCancellationReason,
        status: "cancelled",
        ...(refundedAt ? { refunded_at: refundedAt } : {})
      })
      .eq("id", details.appointment.id);

    if (updateError) {
      return NextResponse.json({ error: "No pudimos cancelar el turno." }, { status: 500 });
    }

    await sendBookingCancelledEmails({
      appointmentId: details.appointment.id,
      cancellationReason: normalizedCancellationReason,
      wasRefunded: shouldRefundMercadoPago
    });

    return NextResponse.json({ ok: true, wasRefunded: shouldRefundMercadoPago });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "No pudimos cancelar el turno."
    }, { status: 500 });
  }
}

async function getCancellationDetails(token: string) {
  if (!token.trim()) {
    return {
      response: NextResponse.json({ error: "Link invalido." }, { status: 400 })
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, business_id, employee_id, service_id, starts_at, status, total_amount, selected_payment_method, mercadopago_payment_id, refunded_at, customer_name_snapshot, customer_email_snapshot, customer_phone_snapshot")
    .eq("public_cancel_token", token)
    .limit(1)
    .maybeSingle<AppointmentCancellationRow>();

  if (appointmentError || !appointment) {
    return {
      response: NextResponse.json({ error: "No encontramos este turno." }, { status: 404 })
    };
  }

  const [businessResult, serviceResult, employeeResult] = await Promise.all([
    supabase
      .from("businesses")
      .select("name, timezone")
      .eq("id", appointment.business_id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("services")
      .select("name, cancellation_lead_minutes")
      .eq("id", appointment.service_id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("employees")
      .select("name")
      .eq("id", appointment.employee_id)
      .limit(1)
      .maybeSingle()
  ]);

  if (businessResult.error || serviceResult.error || employeeResult.error || !serviceResult.data) {
    return {
      response: NextResponse.json({ error: "No pudimos cargar el turno." }, { status: 500 })
    };
  }

  const cancellationLeadMinutes = serviceResult.data.cancellation_lead_minutes ?? 1440;
  const cancelUntil = new Date(new Date(appointment.starts_at).getTime() - cancellationLeadMinutes * 60 * 1000);
  const canCancelByTime = Date.now() <= cancelUntil.getTime();
  const isCancelled = appointment.status === "cancelled";
  const canCancel = !isCancelled && canCancelByTime;
  const cannotCancelReason = isCancelled
    ? "Este turno ya fue cancelado."
    : `Este turno solo se podia cancelar hasta ${formatDateTime(cancelUntil.toISOString(), businessResult.data?.timezone ?? "America/Argentina/Buenos_Aires")}.`;

  return {
    appointment,
    payload: {
      appointmentId: appointment.id,
      businessName: businessResult.data?.name ?? "MiTurnoListo",
      canCancel,
      cancelUntil: cancelUntil.toISOString(),
      cancellationLeadMinutes,
      cannotCancelReason,
      customerName: appointment.customer_name_snapshot,
      employeeName: employeeResult.data?.name ?? "",
      refundedAt: appointment.refunded_at,
      serviceName: serviceResult.data.name,
      startsAt: appointment.starts_at,
      status: appointment.status,
      timeZone: businessResult.data?.timezone ?? "America/Argentina/Buenos_Aires",
      totalAmount: appointment.total_amount,
      wasPaidWithMercadoPago: appointment.selected_payment_method === "card"
    }
  };
}

function formatDateTime(dateTime: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone
  }).format(new Date(dateTime));
}
