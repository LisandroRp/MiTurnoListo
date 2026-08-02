import { NextRequest, NextResponse } from "next/server";

import { PaymentRecord, PaymentStatus } from "@/features/scheduling/types";
import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { formatDateForTimeZone, formatTimeForTimeZone } from "@/lib/networking/utils/date-time";

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
  const [businessResult, appointmentsResult, servicesResult, employeesResult] = await Promise.all([
    supabase
      .from("businesses")
      .select("timezone")
      .eq("id", businessId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("id, service_id, employee_id, starts_at, status, total_amount, selected_payment_method, customer_name_snapshot, customer_email_snapshot, customer_phone_snapshot, mercadopago_payment_id, refunded_at")
      .eq("business_id", businessId)
      .order("starts_at", { ascending: false }),
    supabase
      .from("services")
      .select("id, name")
      .eq("business_id", businessId),
    supabase
      .from("employees")
      .select("id, name")
      .eq("business_id", businessId)
  ]);

  if (businessResult.error || appointmentsResult.error || servicesResult.error || employeesResult.error) {
    return createApiErrorResponse(
      businessResult.error ?? appointmentsResult.error ?? servicesResult.error ?? employeesResult.error,
      {
        code: "PAYMENTS_LOAD_FAILED",
        fallbackMessage: "Unable to load payments.",
        status: 500
      }
    );
  }

  const timeZone = businessResult.data?.timezone ?? "America/Argentina/Buenos_Aires";
  const serviceNameById = new Map((servicesResult.data ?? []).map((service) => [service.id, service.name ?? ""]));
  const employeeNameById = new Map((employeesResult.data ?? []).map((employee) => [employee.id, employee.name ?? ""]));

  return NextResponse.json({
    payments: (appointmentsResult.data ?? []).map((appointment): PaymentRecord => ({
      amount: appointment.total_amount ?? 0,
      appointmentId: appointment.id,
      customerEmail: appointment.customer_email_snapshot ?? "",
      customerName: appointment.customer_name_snapshot ?? "",
      customerPhone: appointment.customer_phone_snapshot ?? "",
      date: formatDateForTimeZone(appointment.starts_at, timeZone),
      employeeName: employeeNameById.get(appointment.employee_id) ?? "",
      id: appointment.id,
      method: appointment.selected_payment_method ?? "cash",
      serviceName: serviceNameById.get(appointment.service_id) ?? "",
      startTime: formatTimeForTimeZone(appointment.starts_at, timeZone),
      status: getPaymentStatus({
        appointmentStatus: appointment.status,
        mercadoPagoPaymentId: appointment.mercadopago_payment_id,
        refundedAt: appointment.refunded_at
      })
    }))
  });
}

function getPaymentStatus({
  appointmentStatus,
  mercadoPagoPaymentId,
  refundedAt
}: {
  appointmentStatus: string | null;
  mercadoPagoPaymentId: string | null;
  refundedAt: string | null;
}): PaymentStatus {
  if (refundedAt) {
    return "refunded";
  }

  if (appointmentStatus === "cancelled") {
    return "cancelled";
  }

  if (appointmentStatus === "confirmed" || mercadoPagoPaymentId) {
    return "paid";
  }

  return "pending";
}

async function authenticateRequest(request: NextRequest, businessId: string) {
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

  return { userId: user.id };
}
