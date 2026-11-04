import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpecialAvailability } from "@/features/scheduling/types";

export async function loadSpecialAvailability(supabase: SupabaseClient, businessId: string, serviceId?: string): Promise<SpecialAvailability[]> {
  let query = supabase.from("service_special_availability")
    .select("id, service_id, date, start_time, end_time, employee_ids")
    .eq("business_id", businessId);
  if (serviceId) query = query.eq("service_id", serviceId);
  const { data, error } = await query.order("date", { ascending: true });
  if (error?.code === "PGRST205" || error?.code === "42P01") return [];
  if (error) throw new Error("Unable to load exceptional availability.");
  return (data ?? []).map((row) => ({
    id: row.id, serviceId: row.service_id, date: row.date,
    start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5), employeeIds: row.employee_ids
  }));
}
