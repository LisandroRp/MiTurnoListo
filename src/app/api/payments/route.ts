import { NextRequest, NextResponse } from "next/server";

import { PaymentRecord, PaymentStatus } from "@/features/scheduling/types";
import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { formatDateForTimeZone, formatTimeForTimeZone } from "@/lib/networking/utils/date-time";

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get("businessId");
  const page = getPositiveIntegerParam(request.nextUrl.searchParams.get("page"), 1);
  const perPage = Math.min(getPositiveIntegerParam(request.nextUrl.searchParams.get("perPage"), 20), 100);
  const status = getPaymentStatusFilter(request.nextUrl.searchParams.get("status"));
  const method = getPaymentMethodFilter(request.nextUrl.searchParams.get("method"));

  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId." }, { status: 400 });
  }

  const authResult = await authenticateRequest(request, businessId);

  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = getSupabaseAdminClient();
  const [businessResult, paymentsResult] = await Promise.all([
    supabase
      .from("businesses")
      .select("timezone")
      .eq("id", businessId)
      .limit(1)
      .maybeSingle(),
    supabase.rpc("get_payment_summaries", {
      method_filter: method,
      page_number: page,
      page_size: perPage,
      status_filter: status,
      target_business_id: businessId
    })
  ]);

  if (businessResult.error || paymentsResult.error) {
    return createApiErrorResponse(
      businessResult.error ?? paymentsResult.error,
      {
        code: "PAYMENTS_LOAD_FAILED",
        fallbackMessage: "Unable to load payments.",
        status: 500
      }
    );
  }

  const timeZone = businessResult.data?.timezone ?? "America/Argentina/Buenos_Aires";
  const rows = (paymentsResult.data ?? []) as PaymentSummaryRow[];
  const firstRow = rows[0];
  const totalItems = Number(firstRow?.total_items ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

  return NextResponse.json({
    data: rows.map((payment): PaymentRecord => ({
      amount: Number(payment.amount ?? 0),
      appointmentId: payment.appointment_id,
      customerEmail: payment.customer_email ?? "",
      customerName: payment.customer_name ?? "",
      customerPhone: payment.customer_phone ?? "",
      date: formatDateForTimeZone(payment.starts_at, timeZone),
      employeeName: payment.employee_name ?? "",
      id: payment.id,
      method: getPaymentMethod(payment.method),
      serviceName: payment.service_name ?? "",
      startTime: formatTimeForTimeZone(payment.starts_at, timeZone),
      status: getPaymentStatus(payment.status)
    })),
    meta: {
      currentPage: Math.min(page, totalPages),
      perPage,
      totalAmount: Number(firstRow?.total_amount ?? 0),
      totalItems,
      totalPages
    }
  });
}

type PaymentSummaryRow = {
  id: string;
  appointment_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  service_name: string | null;
  employee_name: string | null;
  starts_at: string;
  amount: number | string | null;
  method: string | null;
  status: string | null;
  total_items: number | string | null;
  total_amount: number | string | null;
};

function getPaymentStatus(value: string | null): PaymentStatus {
  if (value === "paid" || value === "cancelled" || value === "refunded") {
    return value;
  }

  return "pending";
}

function getPaymentMethod(value: string | null): PaymentRecord["method"] {
  if (value === "card" || value === "transfer" || value === "mixed") {
    return value;
  }

  return "cash";
}

function getPaymentStatusFilter(value: string | null) {
  if (value === "pending" || value === "paid" || value === "cancelled" || value === "refunded") {
    return value;
  }

  return "all";
}

function getPaymentMethodFilter(value: string | null) {
  if (value === "cash" || value === "card" || value === "transfer" || value === "mixed") {
    return value;
  }

  return "all";
}

function getPositiveIntegerParam(value: string | null, fallback: number) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
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
