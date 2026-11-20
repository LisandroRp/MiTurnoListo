import type { SupabaseClient } from "@supabase/supabase-js";

import { getPlanIncludedIds, getVisibleResourceLimit } from "@/features/scheduling/plan-limits";

export async function getPlanPublicAccess(supabase: SupabaseClient, businessId: string, subscriptionTier: string) {
  if (getVisibleResourceLimit(subscriptionTier, "services") === null) {
    return null;
  }

  const [servicesResult, employeesResult] = await Promise.all([
    supabase
      .from("services")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .eq("is_public", true),
    supabase
      .from("employees")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .eq("is_public", true)
  ]);

  if (servicesResult.error || employeesResult.error) {
    throw new Error("Unable to validate plan public access.");
  }

  return {
    serviceIds: getPlanIncludedIds(servicesResult.data ?? [], subscriptionTier, "services")!,
    employeeIds: getPlanIncludedIds(employeesResult.data ?? [], subscriptionTier, "employees")!
  };
}
