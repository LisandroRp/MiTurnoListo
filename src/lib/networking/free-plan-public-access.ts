import type { SupabaseClient } from "@supabase/supabase-js";

import { freePlanLimits, getFreePlanIncludedIds, isFreePlan } from "@/features/scheduling/plan-limits";

export async function getFreePlanPublicAccess(supabase: SupabaseClient, businessId: string, subscriptionTier: string) {
  if (!isFreePlan(subscriptionTier)) {
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
  ]);

  if (servicesResult.error || employeesResult.error) {
    throw new Error("Unable to validate Free plan public access.");
  }

  return {
    serviceIds: getFreePlanIncludedIds(servicesResult.data ?? [], freePlanLimits.visibleServices),
    employeeIds: getFreePlanIncludedIds(employeesResult.data ?? [], freePlanLimits.activeEmployees)
  };
}
