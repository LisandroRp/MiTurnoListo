import { NextRequest, NextResponse } from "next/server";

import { Customer } from "@/features/scheduling/types";
import { CustomerSort, CustomerTagFilter, filterAndSortCustomers, getCustomerTotals, paginateCustomers } from "@/features/scheduling/utils/customer-list";
import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

const batchSize = 100;

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get("businessId");
  const page = getPositiveIntegerParam(request.nextUrl.searchParams.get("page"), 1);
  const perPage = Math.min(getPositiveIntegerParam(request.nextUrl.searchParams.get("perPage"), 20), 100);
  const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
  const sort = getSort(request.nextUrl.searchParams.get("sort"));
  const tag = getTagFilter(request.nextUrl.searchParams.get("tag"));
  const dateFrom = request.nextUrl.searchParams.get("dateFrom") ?? "";
  const dateTo = request.nextUrl.searchParams.get("dateTo") ?? "";

  if (!businessId) {
    return NextResponse.json({ error: "Missing businessId." }, { status: 400 });
  }

  if ((dateFrom && !isValidDate(dateFrom)) || (dateTo && !isValidDate(dateTo)) || (dateFrom && dateTo && dateFrom > dateTo)) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }

  const authResult = await authenticateRequest(request, businessId);

  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = getSupabaseAdminClient();
  const hasGlobalFilters = sort !== "default" || tag !== "all" || Boolean(dateFrom || dateTo);
  const [firstResult, businessResult] = await Promise.all([
    supabase.rpc("get_customer_summaries", {
      page_number: hasGlobalFilters ? 1 : page,
      page_size: hasGlobalFilters ? batchSize : perPage,
      search_query: search,
      target_business_id: businessId
    }),
    dateFrom || dateTo
      ? supabase.from("businesses").select("timezone").eq("id", businessId).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (firstResult.error || businessResult.error) {
    return createApiErrorResponse(firstResult.error ?? businessResult.error, {
      code: "CUSTOMERS_LOAD_FAILED",
      fallbackMessage: "Unable to load customers.",
      status: 500
    });
  }

  const rows = (firstResult.data ?? []) as CustomerSummaryRow[];
  const firstRow = rows[0];
  const totalCustomers = Number(firstRow?.total_customers ?? 0);

  if (hasGlobalFilters) {
    const allRows = [...rows];
    const totalBatches = Math.ceil(totalCustomers / batchSize);

    for (let start = 2; start <= totalBatches; start += 4) {
      const batchPages = Array.from({ length: Math.min(4, totalBatches - start + 1) }, (_, index) => start + index);
      const batchResults = await Promise.all(batchPages.map((pageNumber) => supabase.rpc("get_customer_summaries", {
        page_number: pageNumber,
        page_size: batchSize,
        search_query: search,
        target_business_id: businessId
      })));
      const failedResult = batchResults.find((result) => result.error);

      if (failedResult?.error) {
        return createApiErrorResponse(failedResult.error, {
          code: "CUSTOMERS_LOAD_FAILED",
          fallbackMessage: "Unable to load customers.",
          status: 500
        });
      }

      batchResults.forEach((result) => allRows.push(...((result.data ?? []) as CustomerSummaryRow[])));
    }

    const filtered = filterAndSortCustomers(allRows.map(mapCustomer), {
      dateFrom,
      dateTo,
      sort,
      tag,
      timeZone: businessResult.data?.timezone ?? "America/Argentina/Buenos_Aires"
    });
    const totals = getCustomerTotals(filtered);
    const paginated = paginateCustomers(filtered, page, perPage);

    return NextResponse.json({
      data: paginated.data,
      meta: {
        currentPage: paginated.currentPage,
        perPage,
        recurringCustomers: tag === "all" && !dateFrom && !dateTo ? Number(firstRow?.recurring_customers ?? 0) : totals.recurringCustomers,
        totalBookings: tag === "all" && !dateFrom && !dateTo ? Number(firstRow?.total_bookings ?? 0) : totals.totalBookings,
        totalCustomers: filtered.length,
        totalPages: paginated.totalPages,
        totalRevenue: tag === "all" && !dateFrom && !dateTo ? Number(firstRow?.total_revenue_sum ?? 0) : totals.totalRevenue
      }
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalCustomers / perPage));

  return NextResponse.json({
    data: rows.map(mapCustomer),
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

function mapCustomer(customer: CustomerSummaryRow): Customer {
  return {
    bookingCount: Number(customer.booking_count ?? 0),
    email: customer.email ?? "",
    fullName: customer.full_name ?? "",
    id: customer.id,
    lastBookedAt: customer.last_booked_at ?? "",
    lastServiceName: customer.last_service_name ?? "",
    phone: customer.phone ?? "",
    totalRevenue: Number(customer.total_revenue ?? 0)
  };
}

function getSort(value: string | null): CustomerSort {
  if (value === "lastBookingDesc" || value === "lastBookingAsc" || value === "mostSpent" || value === "mostBookings") return value;
  return "default";
}

function getTagFilter(value: string | null): CustomerTagFilter {
  if (value === "active" || value === "atRisk" || value === "frequent" || value === "new" || value === "vip") return value;
  return "all";
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
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
