import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidSpecialAvailability } from "@/features/scheduling/special-availability";
import { formatTodayForTimeZone } from "@/lib/networking/utils/date-time";

export async function saveSpecialAvailability(supabase: SupabaseClient, businessId: string, input: unknown, timeZone: string) {
  if (!isValidSpecialAvailability(input) || input.date < formatTodayForTimeZone(timeZone)) {
    throw new Error("SPECIAL_AVAILABILITY:Revisá la fecha, la franja horaria y los profesionales.");
  }
  const opening = input;
  const [serviceResult, linksResult, employeesResult, blocksResult, existingResult] = await Promise.all([
    supabase.from("services").select("id, duration_minutes").eq("id", opening.serviceId).eq("business_id", businessId).eq("is_active", true).maybeSingle(),
    supabase.from("service_employees").select("employee_id").eq("service_id", opening.serviceId),
    supabase.from("employees").select("id").eq("business_id", businessId).eq("is_active", true).in("id", opening.employeeIds),
    supabase.from("business_day_blocks").select("employee_id").eq("business_id", businessId).lte("starts_on", opening.date).gte("ends_on", opening.date),
    supabase.from("service_special_availability").select("business_id").eq("id", opening.id).maybeSingle()
  ]);
  if ([serviceResult, linksResult, employeesResult, blocksResult, existingResult].some((result) => result.error)) {
    throw new Error("Unable to validate exceptional availability.");
  }
  if (!serviceResult.data || (existingResult.data && existingResult.data.business_id !== businessId)) {
    throw new Error("SPECIAL_AVAILABILITY:El servicio o la apertura no pertenecen a este negocio.");
  }
  const assignedIds = new Set((linksResult.data ?? []).map((row) => row.employee_id));
  const activeIds = new Set((employeesResult.data ?? []).map((row) => row.id));
  if (opening.employeeIds.some((id) => !assignedIds.has(id) || !activeIds.has(id))) {
    throw new Error("SPECIAL_AVAILABILITY:Seleccioná profesionales activos asignados al servicio.");
  }
  if ((blocksResult.data ?? []).some((block) => !block.employee_id || opening.employeeIds.includes(block.employee_id))) {
    throw new Error("SPECIAL_AVAILABILITY:La fecha coincide con un cierre del negocio o de un profesional. Revisá los días bloqueados.");
  }
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  if (minutes(opening.end) - minutes(opening.start) < serviceResult.data.duration_minutes) {
    throw new Error("SPECIAL_AVAILABILITY:La franja debe permitir al menos un turno completo del servicio.");
  }
  const values = {
    business_id: businessId, service_id: opening.serviceId, date: opening.date,
    start_time: opening.start, end_time: opening.end, employee_ids: opening.employeeIds
  };
  const { error } = existingResult.data
    ? await supabase.from("service_special_availability").update(values).eq("id", opening.id).eq("business_id", businessId)
    : await supabase.from("service_special_availability").insert({ id: opening.id, ...values });
  if (error) throw new Error("Unable to save exceptional availability.");
}
