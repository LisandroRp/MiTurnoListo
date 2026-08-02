import { NextRequest, NextResponse } from "next/server";

import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

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
  const [customersResult, appointmentsResult, servicesResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name, email, phone, last_booked_at")
      .eq("business_id", businessId)
      .order("last_booked_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("customer_id, service_id, starts_at, status, total_amount")
      .eq("business_id", businessId)
      .not("customer_id", "is", null)
      .order("starts_at", { ascending: false }),
    supabase
      .from("services")
      .select("id, name")
      .eq("business_id", businessId)
  ]);

  if (customersResult.error || appointmentsResult.error || servicesResult.error) {
    return createApiErrorResponse(customersResult.error ?? appointmentsResult.error ?? servicesResult.error, {
      code: "CUSTOMERS_LOAD_FAILED",
      fallbackMessage: "Unable to load customers.",
      status: 500
    });
  }

  const bookingCountByCustomerId = new Map<string, number>();
  const totalRevenueByCustomerId = new Map<string, number>();
  const lastServiceByCustomerId = new Map<string, string>();
  const serviceNameById = new Map((servicesResult.data ?? []).map((service) => [service.id, service.name ?? ""]));

  for (const appointment of appointmentsResult.data ?? []) {
    if (appointment.customer_id) {
      bookingCountByCustomerId.set(
        appointment.customer_id,
        (bookingCountByCustomerId.get(appointment.customer_id) ?? 0) + 1
      );

      if (appointment.status !== "cancelled") {
        totalRevenueByCustomerId.set(
          appointment.customer_id,
          (totalRevenueByCustomerId.get(appointment.customer_id) ?? 0) + (appointment.total_amount ?? 0)
        );
      }

      if (!lastServiceByCustomerId.has(appointment.customer_id)) {
        lastServiceByCustomerId.set(appointment.customer_id, serviceNameById.get(appointment.service_id) ?? "");
      }
    }
  }

  return NextResponse.json({
    customers: (customersResult.data ?? []).map((customer) => ({
      bookingCount: bookingCountByCustomerId.get(customer.id) ?? 0,
      email: customer.email ?? "",
      fullName: customer.full_name ?? "",
      id: customer.id,
      lastBookedAt: customer.last_booked_at ?? "",
      lastServiceName: lastServiceByCustomerId.get(customer.id) ?? "",
      phone: customer.phone ?? "",
      totalRevenue: totalRevenueByCustomerId.get(customer.id) ?? 0
    }))
  });
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
