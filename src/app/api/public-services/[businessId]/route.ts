import { NextResponse } from "next/server";

import { Locale, PaymentMethod, ThemeId } from "@/features/scheduling/types";
import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { normalizeStoredImageUrl } from "@/lib/networking/utils/assets";
import { isUuid } from "@/lib/slugs";

type RouteContext = {
  params: Promise<{
    businessId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { businessId: businessKey } = await context.params;
  const supabase = getSupabaseAdminClient();
  const businessResult = await supabase
    .from("businesses")
    .select("id, name, public_slug, address, public_description, public_logo_url, public_opening_hours")
    .eq(isUuid(businessKey) ? "id" : "public_slug", businessKey)
    .limit(1)
    .maybeSingle();

  if (businessResult.error || !businessResult.data) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  const businessId = businessResult.data.id;
  const [membershipResult, servicesResult] = await Promise.all([
    supabase
      .from("business_memberships")
      .select("locale, theme")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, public_slug, name, description, price_amount, deposit_amount, duration_minutes, capacity, payment_mode")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .eq("is_public", true)
      .order("name", { ascending: true })
  ]);

  if (membershipResult.error || servicesResult.error) {
    return createApiErrorResponse(membershipResult.error ?? servicesResult.error, {
      code: "PUBLIC_SERVICES_LOAD_FAILED",
      fallbackMessage: "Unable to load public services.",
      status: 500
    });
  }

  const publicServices = servicesResult.data ?? [];
  const publicServiceIds = publicServices.map((service) => service.id);
  let reservableServiceIds = new Set<string>();
  const employeeNamesByServiceId = new Map<string, string[]>();

  if (publicServiceIds.length > 0) {
    const serviceEmployeesResult = await supabase
      .from("service_employees")
      .select("service_id, employee_id")
      .in("service_id", publicServiceIds);

    if (serviceEmployeesResult.error) {
      return createApiErrorResponse(serviceEmployeesResult.error, {
        code: "PUBLIC_SERVICES_LOAD_FAILED",
        fallbackMessage: "Unable to load public services.",
        status: 500
      });
    }

    const assignedEmployeeIds = Array.from(new Set((serviceEmployeesResult.data ?? []).map((row) => row.employee_id)));
    const employeesResult = assignedEmployeeIds.length > 0
      ? await supabase
          .from("employees")
          .select("id, name")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .eq("is_public", true)
          .in("id", assignedEmployeeIds)
      : null;

    if (employeesResult?.error) {
      return createApiErrorResponse(employeesResult.error, {
        code: "PUBLIC_SERVICES_LOAD_FAILED",
        fallbackMessage: "Unable to load public services.",
        status: 500
      });
    }

    const reservableEmployees = employeesResult?.data ?? [];
    const reservableEmployeeIds = new Set(reservableEmployees.map((employee) => employee.id));
    const employeeNameById = new Map(reservableEmployees.map((employee) => [employee.id, employee.name]));

    (serviceEmployeesResult.data ?? []).forEach((row) => {
      const employeeName = employeeNameById.get(row.employee_id);

      if (!employeeName) {
        return;
      }

      employeeNamesByServiceId.set(row.service_id, [
        ...(employeeNamesByServiceId.get(row.service_id) ?? []),
        employeeName
      ]);
    });
    reservableServiceIds = new Set(
      (serviceEmployeesResult.data ?? [])
        .filter((row) => reservableEmployeeIds.has(row.employee_id))
        .map((row) => row.service_id)
    );
  }

  return NextResponse.json({
    address: businessResult.data.address ?? "",
    businessName: businessResult.data.name,
    businessSlug: businessResult.data.public_slug ?? "",
    locale: (membershipResult.data?.locale ?? "es") as Locale,
    publicDescription: businessResult.data.public_description ?? "",
    publicLogoUrl: normalizeStoredImageUrl(businessResult.data.public_logo_url),
    publicOpeningHours: businessResult.data.public_opening_hours ?? "",
    services: publicServices.filter((service) => reservableServiceIds.has(service.id)).map((service) => ({
      capacity: service.capacity,
      deposit: service.deposit_amount,
      description: service.description ?? "",
      durationMinutes: service.duration_minutes,
      employeeNames: employeeNamesByServiceId.get(service.id) ?? [],
      id: service.id,
      name: service.name,
      paymentMethod: service.payment_mode as PaymentMethod,
      price: service.price_amount,
      publicSlug: service.public_slug ?? ""
    })),
    theme: (membershipResult.data?.theme ?? "coral") as ThemeId
  });
}
