import { NextRequest, NextResponse } from "next/server";

import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get("businessId");
  const page = getPositiveIntegerParam(request.nextUrl.searchParams.get("page"), 1);
  const perPage = Math.min(getPositiveIntegerParam(request.nextUrl.searchParams.get("perPage"), 20), 100);
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";

  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId." }, { status: 400 });
  }

  const authResult = await authenticateRequest(request, businessId);

  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_customer_summaries", {
    page_number: page,
    page_size: perPage,
    search_query: search,
    target_business_id: businessId
  });

  if (error) {
    return createApiErrorResponse(error, {
      code: "CUSTOMERS_LOAD_FAILED",
      fallbackMessage: "Unable to load customers.",
      status: 500
    });
  }

  const rows = (data ?? []) as CustomerSummaryRow[];
  const firstRow = rows[0];
  const totalCustomers = Number(firstRow?.total_customers ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCustomers / perPage));

  return NextResponse.json({
    data: rows.map((customer) => ({
      bookingCount: Number(customer.booking_count ?? 0),
      email: customer.email ?? "",
      fullName: customer.full_name ?? "",
      id: customer.id,
      lastBookedAt: customer.last_booked_at ?? "",
      lastServiceName: customer.last_service_name ?? "",
      phone: customer.phone ?? "",
      totalRevenue: Number(customer.total_revenue ?? 0)
    })),
    meta: {
      currentPage: Math.min(page, totalPages),
      perPage,
      recurringCustomers: Number(firstRow?.recurring_customers ?? 0),
      totalBookings: Number(firstRow?.total_bookings ?? 0),
      totalCustomers,
      totalPages,
      totalRevenue: Number(firstRow?.total_revenue_sum ?? 0)
    }
  });
}

type CustomerSummaryRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  last_booked_at: string | null;
  booking_count: number | string | null;
  total_revenue: number | string | null;
  last_service_name: string | null;
  total_customers: number | string | null;
  recurring_customers?: number | string | null;
  total_bookings?: number | string | null;
  total_revenue_sum?: number | string | null;
};

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
