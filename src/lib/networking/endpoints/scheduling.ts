"use client";

import { BusinessPaymentSettings, Locale, ThemeId } from "@/features/scheduling/types";
import { getSupabaseBrowserClient } from "@/lib/networking/clients/supabase-browser";
import {
  buildDashboardMetrics,
  createEmptySchedule,
  getDefaultFocusedDate,
  mapAppointments,
  mapEmployees,
  mapProfile,
  mapServices,
  themeOptions
} from "@/lib/networking/mappers/scheduling";
import { getAccessToken } from "@/lib/networking/endpoints/auth";
import { getPaymentSettings, savePaymentSettings as savePaymentSettingsRequest } from "@/lib/networking/endpoints/payment-settings";
import {
  cancelProSubscription,
  createProSubscriptionCheckout,
  syncProSubscriptionStatus
} from "@/lib/networking/endpoints/subscription";
import { getBrowserTimeZone } from "@/lib/networking/utils/date-time";

type SchedulingSnapshot = {
  appointments: ReturnType<typeof mapAppointments>;
  businessId: string;
  dashboardMetrics: ReturnType<typeof buildDashboardMetrics>;
  employees: ReturnType<typeof mapEmployees>;
  focusedDate: string;
  locale: Locale;
  paymentSettings: BusinessPaymentSettings;
  profile: ReturnType<typeof mapProfile>;
  services: ReturnType<typeof mapServices>;
  theme: ThemeId;
  timeZone: string;
  themeOptions: ThemeId[];
};

type ServiceInput = SchedulingSnapshot["services"][number];
type EmployeeInput = SchedulingSnapshot["employees"][number];
type AppointmentInput = SchedulingSnapshot["appointments"][number];

export async function loadSchedulingSnapshot() {
  const supabase = getSupabaseBrowserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Authenticated user not found.");
  }

  const user = authData.user;

  const { data: membership, error: membershipError } = await supabase
    .from("business_memberships")
    .select("business_id, locale, theme")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error("Business membership not found.");
  }

  const businessId = membership.business_id;

  const [
    userProfileResult,
    businessResult,
    employeeResult,
    employeeAvailabilityResult,
    serviceResult,
    serviceEmployeeResult,
    serviceAvailabilityResult,
    appointmentResult,
    paymentSettings
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("first_name, last_name, avatar_url")
      .eq("id", user.id)
      .limit(1)
      .single(),
    supabase
      .from("businesses")
      .select("name, address, subscription_tier, timezone")
      .eq("id", businessId)
      .limit(1)
      .single(),
    supabase
      .from("employees")
      .select("id, name, role, description, image_url, color_token")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("employee_weekly_availability")
      .select("id, employee_id, weekday, start_time, end_time"),
    supabase
      .from("services")
      .select("id, name, description, image_url, price_amount, deposit_amount, duration_minutes, capacity, reservation_lead_minutes, payment_mode, is_public")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("service_employees")
      .select("service_id, employee_id"),
    supabase
      .from("service_weekly_availability")
      .select("id, service_id, weekday, start_time, end_time"),
    supabase
      .from("appointments")
      .select("id, service_id, employee_id, starts_at, ends_at, status, total_amount, selected_payment_method, party_size, customer_name_snapshot, customer_email_snapshot, customer_phone_snapshot")
      .eq("business_id", businessId)
      .order("starts_at", { ascending: true }),
    getPaymentSettings(businessId)
  ]);

  if (userProfileResult.error || businessResult.error || employeeResult.error || employeeAvailabilityResult.error) {
    throw new Error("Unable to load the user workspace.");
  }

  if (serviceResult.error || serviceEmployeeResult.error || serviceAvailabilityResult.error || appointmentResult.error) {
    throw new Error("Unable to load scheduling data.");
  }

  const timeZone = businessResult.data.timezone;
  const employees = mapEmployees(
    employeeResult.data ?? [],
    (employeeAvailabilityResult.data ?? []).filter((row) =>
      (employeeResult.data ?? []).some((employee) => employee.id === row.employee_id)
    )
  );
  const services = mapServices(
    serviceResult.data ?? [],
    (serviceEmployeeResult.data ?? []).filter((row) =>
      (serviceResult.data ?? []).some((service) => service.id === row.service_id)
    ),
    (serviceAvailabilityResult.data ?? []).filter((row) =>
      (serviceResult.data ?? []).some((service) => service.id === row.service_id)
    )
  );
  const appointments = mapAppointments(appointmentResult.data ?? [], timeZone);
  const focusedDate = getDefaultFocusedDate(appointments, timeZone);
  const profile = mapProfile(userProfileResult.data, businessResult.data, user.email ?? "");

  return {
    appointments,
    businessId,
    dashboardMetrics: buildDashboardMetrics(appointments, employees, focusedDate),
    employees,
    focusedDate,
    locale: membership.locale,
    paymentSettings,
    profile,
    services,
    theme: membership.theme,
    timeZone,
    themeOptions
  } satisfies SchedulingSnapshot;
}

export async function updateSchedulingPreferences({
  businessId,
  locale,
  theme
}: {
  businessId: string;
  locale?: Locale;
  theme?: ThemeId;
}) {
  const supabase = getSupabaseBrowserClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Authenticated user not found.");
  }

  const { error } = await supabase
    .from("business_memberships")
    .update({
      ...(locale ? { locale } : {}),
      ...(theme ? { theme } : {})
    })
    .eq("business_id", businessId)
    .eq("user_id", authData.user.id);

  if (error) {
    throw new Error("Unable to update preferences.");
  }
}

export async function startProSubscription(businessId: string) {
  return createProSubscriptionCheckout(businessId);
}

export async function deleteProSubscription(businessId: string) {
  return cancelProSubscription(businessId);
}

export async function refreshWorkspaceSubscription(businessId: string, preapprovalId?: string) {
  return syncProSubscriptionStatus(businessId, preapprovalId);
}

export async function saveEmployee(businessId: string, employee: EmployeeInput) {
  await runSchedulingMutation({
    action: "saveEmployee",
    businessId,
    employee
  });
}

export async function deleteEmployee(employeeId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", employeeId);

  if (error) {
    throw new Error("Unable to delete the employee.");
  }
}

export async function saveService(businessId: string, service: ServiceInput) {
  await runSchedulingMutation({
    action: "saveService",
    businessId,
    service
  });
}

export async function deleteService(serviceId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", serviceId);

  if (error) {
    throw new Error("Unable to delete the service.");
  }
}

export async function deleteAppointment(businessId: string, appointmentId: string) {
  await runSchedulingMutation({
    action: "cancelAppointment",
    appointmentId,
    businessId
  });
}

export async function markAppointmentPaid(businessId: string, appointmentId: string) {
  await runSchedulingMutation({
    action: "markAppointmentPaid",
    appointmentId,
    businessId
  });
}

export async function createDashboardAppointment({
  appointment,
  businessId,
  service
}: {
  appointment: AppointmentInput;
  businessId: string;
  service: ServiceInput;
}) {
  const timeZone = getBrowserTimeZone();
  await runSchedulingMutation({
    action: "createAppointment",
    businessId,
    appointment,
    service,
    timeZone
  });
}

export async function savePaymentSettings(businessId: string, settings: BusinessPaymentSettings) {
  return savePaymentSettingsRequest(businessId, settings);
}

async function runSchedulingMutation(payload: unknown) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Authenticated session not found.");
  }

  const response = await fetch("/api/scheduling/mutations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await getMutationErrorMessage(response));
  }
}

async function getMutationErrorMessage(response: Response) {
  try {
    const payload = await response.json() as {
      error?: string;
    };

    if (payload.error?.trim()) {
      return payload.error;
    }
  } catch {
    return "Unable to save changes.";
  }

  return "Unable to save changes.";
}

export function createNewEmployeeDraft() {
  return {
    id: globalThis.crypto.randomUUID(),
    name: "",
    role: "",
    description: "",
    imageUrl: "",
    color: "employee-coral",
    initials: "NA",
    schedule: createEmptySchedule()
  };
}

export function createNewServiceDraft(employeeIds: string[]) {
  return {
    id: globalThis.crypto.randomUUID(),
    name: "",
    description: "",
    imageUrl: "",
    price: 0,
    capacity: 1,
    deposit: 0,
    durationMinutes: 30,
    paymentMethod: "mixed" as const,
    isVisible: true,
    reservationLeadMinutes: 30,
    schedule: createEmptySchedule(),
    employeeIds
  };
}
