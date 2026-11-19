import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSubscriptionTier } from "@/lib/subscription-plans";

export async function reconcileSubscriptionEntitlement(supabase: SupabaseClient, businessId: string) {
  const { data, error } = await supabase.rpc("reconcile_business_subscription", { p_business_id: businessId });
  if (error || !isSubscriptionTier(data)) throw new Error("Unable to reconcile subscription access.");
  return data;
}
