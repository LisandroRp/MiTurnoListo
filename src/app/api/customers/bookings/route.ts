import { NextRequest, NextResponse } from "next/server";

import { CustomerBooking, CustomerBookingsResponse } from "@/features/scheduling/types";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

const pageSize = 10;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const businessId = params.get("businessId") ?? "";
  const customerId = params.get("customerId") ?? "";
  const page = Number(params.get("page") ?? 1);
  if (!uuidPattern.test(businessId) || !uuidPattern.test(customerId) || !Number.isSafeInteger(page) || page < 1) {
    return NextResponse.json({ error: "Invalid booking history request." }, { status: 400 });
  }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  const db = getSupabaseAdminClient();
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  const { data: membership, error: membershipError } = await db.from("business_memberships")
    .select("role").eq("business_id", businessId).eq("user_id", user.id).limit(1).maybeSingle();
  if (membershipError || !membership) return NextResponse.json({ error: "Membership not found." }, { status: 403 });
  const [customer, business] = await Promise.all([
    db.from("customers").select("id").eq("business_id", businessId).eq("id", customerId).maybeSingle(),
    db.from("businesses").select("timezone").eq("id", businessId).maybeSingle()
  ]);
  if (customer.error || business.error) return loadError();
  if (!customer.data) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  const now = new Date().toISOString();
  const scopedQuery = () => db.from("appointments").select("id", { count: "exact", head: true })
    .eq("business_id", businessId).eq("customer_id", customerId);
  const [upcoming, past] = await Promise.all([scopedQuery().gte("starts_at", now), scopedQuery().lt("starts_at", now)]);
  if (upcoming.error || past.error) return loadError();
  const upcomingCount = upcoming.count ?? 0;
  const total = upcomingCount + (past.count ?? 0);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
  const offset = (currentPage - 1) * pageSize;
  const upcomingSize = Math.max(0, Math.min(pageSize, upcomingCount - offset));
  const pastSize = Math.min(pageSize - upcomingSize, Math.max(0, total - offset - upcomingSize));
  const rowsQuery = () => db.from("appointments")
    .select("id, starts_at, ends_at, appointment_status, payment_status, services(name), employees(name)")
    .eq("business_id", businessId).eq("customer_id", customerId);
  const [nextRows, previousRows] = await Promise.all([
    upcomingSize ? rowsQuery().gte("starts_at", now).order("starts_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + upcomingSize - 1) : Promise.resolve({ data: [], error: null }),
    pastSize ? rowsQuery().lt("starts_at", now).order("starts_at", { ascending: false }).order("id", { ascending: false }).range(Math.max(0, offset - upcomingCount), Math.max(0, offset - upcomingCount) + pastSize - 1) : Promise.resolve({ data: [], error: null })
  ]);
  if (nextRows.error || previousRows.error) return loadError();
  const data: CustomerBooking[] = [...(nextRows.data ?? []), ...(previousRows.data ?? [])].map((row) => ({
    id: row.id, startsAt: row.starts_at, endsAt: row.ends_at,
    serviceName: relationName(row.services), employeeName: relationName(row.employees),
    appointmentStatus: row.appointment_status, paymentStatus: row.payment_status, isUpcoming: row.starts_at >= now
  }));
  return NextResponse.json({ data, meta: { currentPage, perPage: pageSize, total, timeZone: business.data?.timezone ?? "America/Argentina/Buenos_Aires" } } satisfies CustomerBookingsResponse, {
    headers: { "Cache-Control": "private, no-store" }
  });
}

function relationName(value: { name: string } | { name: string }[] | null): string {
  return (Array.isArray(value) ? value[0]?.name : value?.name) ?? "";
}

function loadError() {
  return NextResponse.json({ error: "Unable to load booking history." }, { status: 500 });
}
