import { NextResponse } from "next/server";

import { Locale, PaymentMethod, ThemeId } from "@/features/scheduling/types";
import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

type RouteContext = {
  params: Promise<{
    businessId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { businessId } = await context.params;
  const supabase = getSupabaseAdminClient();
  const [businessResult, membershipResult, servicesResult] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name")
      .eq("id", businessId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("business_memberships")
      .select("locale, theme")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, name, description, image_url, price_amount, deposit_amount, duration_minutes, capacity, payment_mode")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .eq("is_public", true)
      .order("name", { ascending: true })
  ]);

  if (businessResult.error || !businessResult.data) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  if (membershipResult.error || servicesResult.error) {
    return createApiErrorResponse(membershipResult.error ?? servicesResult.error, {
      code: "PUBLIC_SERVICES_LOAD_FAILED",
      fallbackMessage: "Unable to load public services.",
      status: 500
    });
  }

  return NextResponse.json({
    businessName: businessResult.data.name,
    locale: (membershipResult.data?.locale ?? "es") as Locale,
    services: (servicesResult.data ?? []).map((service) => ({
      capacity: service.capacity,
      deposit: service.deposit_amount,
      description: service.description ?? "",
      durationMinutes: service.duration_minutes,
      id: service.id,
      imageUrl: service.image_url ?? "",
      name: service.name,
      paymentMethod: service.payment_mode as PaymentMethod,
      price: service.price_amount
    })),
    theme: (membershipResult.data?.theme ?? "coral") as ThemeId
  });
}
