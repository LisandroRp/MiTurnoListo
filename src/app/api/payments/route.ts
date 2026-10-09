import { NextRequest, NextResponse } from "next/server";

import { PaymentMethod, PaymentRecord, PaymentStatus } from "@/features/scheduling/types";
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

  let statusSummary: Record<PaymentStatus, PaymentSummaryBucket>;
  let methodSummary: Record<PaymentMethod, PaymentSummaryBucket>;

  try {
    [statusSummary, methodSummary] = await Promise.all([
      getPaymentStatusSummary(supabase, businessId, method),
      getPaymentMethodSummary(supabase, businessId, status)
    ]);
  } catch (error) {
    return createApiErrorResponse(
      error,
      {
        code: "PAYMENTS_SUMMARY_LOAD_FAILED",
        fallbackMessage: "Unable to load payment summaries.",
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
      methodSummary,
      perPage,
      statusSummary,
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

type PaymentSummaryBucket = {
  totalAmount: number;
  totalItems: number;
};

const paymentStatuses: PaymentStatus[] = ["pending", "paid", "cancelled", "refunded"];
const paymentMethods: PaymentMethod[] = ["cash", "card", "transfer", "mixed"];

async function getPaymentStatusSummary(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  businessId: string,
  method: PaymentMethod | "all"
): Promise<Record<PaymentStatus, PaymentSummaryBucket>> {
  const entries = await Promise.all(
    paymentStatuses.map(async (status) => {
      const summary = await getPaymentSummaryBucket(supabase, {
        businessId,
        method,
        status
      });

      return [status, summary] as const;
    })
  );

  return Object.fromEntries(entries) as Record<PaymentStatus, PaymentSummaryBucket>;
}

async function getPaymentMethodSummary(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  businessId: string,
  status: PaymentStatus | "all"
): Promise<Record<PaymentMethod, PaymentSummaryBucket>> {
  const entries = await Promise.all(
    paymentMethods.map(async (method) => {
      const summary = await getPaymentSummaryBucket(supabase, {
        businessId,
        method,
        status
      });

      return [method, summary] as const;
    })
  );

  return Object.fromEntries(entries) as Record<PaymentMethod, PaymentSummaryBucket>;
}

async function getPaymentSummaryBucket(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  filters: {
    businessId: string;
    method: PaymentMethod | "all";
    status: PaymentStatus | "all";
  }
): Promise<PaymentSummaryBucket> {
  const result = await supabase.rpc("get_payment_summaries", {
    method_filter: filters.method,
    page_number: 1,
    page_size: 1,
    status_filter: filters.status,
    target_business_id: filters.businessId
  });

  if (result.error) {
    throw result.error;
  }

  const firstRow = ((result.data ?? []) as PaymentSummaryRow[])[0];

  return {
    totalAmount: Number(firstRow?.total_amount ?? 0),
    totalItems: Number(firstRow?.total_items ?? 0)
  };
}

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

function getPaymentStatusFilter(value: string | null): PaymentStatus | "all" {
  if (value === "pending" || value === "paid" || value === "cancelled" || value === "refunded") {
    return value;
  }

  return "all";
}

function getPaymentMethodFilter(value: string | null): PaymentMethod | "all" {
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
