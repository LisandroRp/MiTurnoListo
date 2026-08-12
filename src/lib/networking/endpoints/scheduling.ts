"use client";

import { BusinessPaymentSettings, BusinessProfile, Locale, ThemeId } from "@/features/scheduling/types";
import { minimumCancellationLeadMinutes } from "@/features/scheduling/service-cancellation-policy";
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
    serviceAddonResult,
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
      .select("name, address, public_description, public_logo_url, public_opening_hours, subscription_tier, timezone")
      .eq("id", businessId)
      .limit(1)
      .single(),
    supabase
      .from("employees")
      .select("id, name, role, description, image_url, color_token, is_active")
      .eq("business_id", businessId)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("employee_weekly_availability")
      .select("id, employee_id, weekday, start_time, end_time"),
    supabase
      .from("services")
      .select("id, name, description, image_url, price_amount, deposit_amount, duration_minutes, capacity, reservation_lead_minutes, cancellation_lead_minutes, payment_mode, is_public, is_active")
      .eq("business_id", businessId)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("service_employees")
      .select("service_id, employee_id"),
    supabase
      .from("service_weekly_availability")
      .select("id, service_id, weekday, start_time, end_time"),
    supabase
      .from("service_addons")
      .select("id, service_id, name, price_amount, is_active, sort_order"),
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

  if (serviceResult.error || serviceEmployeeResult.error || serviceAvailabilityResult.error || serviceAddonResult.error || appointmentResult.error) {
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
    ),
    (serviceAddonResult.data ?? []).filter((row) =>
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

export async function archiveEmployee(businessId: string, employeeId: string) {
  await runSchedulingMutation({
    action: "archiveEmployee",
    businessId,
    employeeId
  });
}

export async function unarchiveEmployee(businessId: string, employeeId: string) {
  await runSchedulingMutation({
    action: "unarchiveEmployee",
    businessId,
    employeeId
  });
}

export async function deleteEmployee(businessId: string, employeeId: string) {
  await runSchedulingMutation({
    action: "deleteEmployee",
    businessId,
    employeeId
  });
}

export async function saveService(businessId: string, service: ServiceInput) {
  await runSchedulingMutation({
    action: "saveService",
    businessId,
    service
  });
}

export async function archiveService(businessId: string, serviceId: string) {
  await runSchedulingMutation({
    action: "archiveService",
    businessId,
    serviceId
  });
}

export async function unarchiveService(businessId: string, serviceId: string) {
  await runSchedulingMutation({
    action: "unarchiveService",
    businessId,
    serviceId
  });
}

export async function deleteService(businessId: string, serviceId: string) {
  await runSchedulingMutation({
    action: "deleteService",
    businessId,
    serviceId
  });
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

export async function rescheduleAppointment({
  appointmentId,
  businessId,
  date,
  employeeId
}: {
  appointmentId: string;
  businessId: string;
  date: string;
  employeeId: string;
}) {
  await runSchedulingMutation({
    action: "rescheduleAppointment",
    appointmentId,
    businessId,
    date,
    employeeId
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

export async function saveBusinessProfile(businessId: string, profile: BusinessProfile) {
  const token = await getAccessToken();
  const response = await fetch("/api/business-profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      businessId,
      profile
    })
  });
  const payload = await response.json().catch(() => null) as { error?: string; profile?: BusinessProfile } | null;

  if (!response.ok || !payload?.profile) {
    throw new Error(payload?.error ?? "Unable to save business profile.");
  }

  return payload.profile;
}

export async function saveProfileAvatar(businessId: string, avatarUrl: string) {
  const token = await getAccessToken();
  const response = await fetch("/api/profile/avatar", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      avatarUrl,
      businessId
    })
  });
  const payload = await response.json().catch(() => null) as { avatarUrl?: string; error?: string } | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? "Unable to save profile image.");
  }

  return payload.avatarUrl ?? "";
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
    isArchived: false,
    schedule: createEmptySchedule()
  };
}

export function createNewServiceDraft() {
  return {
    id: globalThis.crypto.randomUUID(),
    name: "",
    description: "",
    imageUrl: "",
    price: 0,
    capacity: 1,
    deposit: 0,
    durationMinutes: 0,
    paymentMethod: "cash" as const,
    isVisible: true,
    isArchived: false,
    reservationLeadMinutes: 0,
    cancellationLeadMinutes: minimumCancellationLeadMinutes,
    schedule: createEmptySchedule(),
    employeeIds: [],
    addons: []
  };
}
