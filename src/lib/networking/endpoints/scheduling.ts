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
  mapScheduleToAvailabilityRows,
  mapServices,
  themeOptions
} from "@/lib/networking/mappers/scheduling";
import { getPaymentSettings, savePaymentSettings as savePaymentSettingsRequest } from "@/lib/networking/endpoints/payment-settings";
import { buildIsoInTimeZone, getBrowserTimeZone } from "@/lib/networking/utils/date-time";

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

export async function updateSubscriptionTier(businessId: string, subscriptionTier: SchedulingSnapshot["profile"]["subscriptionTier"]) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      subscription_tier: subscriptionTier
    })
    .eq("id", businessId);

  if (error) {
    throw new Error("Unable to update the subscription tier.");
  }
}

export async function saveEmployee(businessId: string, employee: EmployeeInput) {
  const supabase = getSupabaseBrowserClient();
  const { error: employeeError } = await supabase
    .from("employees")
    .upsert({
      id: employee.id,
      business_id: businessId,
      name: employee.name,
      role: employee.role,
      description: employee.description,
      image_url: employee.imageUrl || null,
      color_token: employee.color,
      is_active: true,
      is_bookable: true
    });

  if (employeeError) {
    throw new Error("Unable to save the employee.");
  }

  const { error: deleteError } = await supabase
    .from("employee_weekly_availability")
    .delete()
    .eq("employee_id", employee.id);

  if (deleteError) {
    throw new Error("Unable to save the employee schedule.");
  }

  const availabilityRows = mapScheduleToAvailabilityRows(employee.schedule, "employee_id", employee.id);

  if (availabilityRows.length > 0) {
    const { error: insertError } = await supabase
      .from("employee_weekly_availability")
      .insert(availabilityRows);

    if (insertError) {
      throw new Error("Unable to save the employee schedule.");
    }
  }
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
  const supabase = getSupabaseBrowserClient();
  const { error: serviceError } = await supabase
    .from("services")
    .upsert({
      id: service.id,
      business_id: businessId,
      slug: buildSlug(service.name, service.id),
      name: service.name,
      description: service.description,
      image_url: service.imageUrl || null,
      price_amount: service.price,
      deposit_amount: service.deposit,
      currency_code: "ARS",
      duration_minutes: service.durationMinutes,
      capacity: service.capacity,
      reservation_lead_minutes: service.reservationLeadMinutes,
      payment_mode: service.paymentMethod,
      is_public: service.isVisible,
      is_active: true
    });

  if (serviceError) {
    throw new Error("Unable to save the service.");
  }

  const { error: availabilityDeleteError } = await supabase
    .from("service_weekly_availability")
    .delete()
    .eq("service_id", service.id);

  if (availabilityDeleteError) {
    throw new Error("Unable to save the service schedule.");
  }

  const { error: employeesDeleteError } = await supabase
    .from("service_employees")
    .delete()
    .eq("service_id", service.id);

  if (employeesDeleteError) {
    throw new Error("Unable to save service assignments.");
  }

  const availabilityRows = mapScheduleToAvailabilityRows(service.schedule, "service_id", service.id);

  if (availabilityRows.length > 0) {
    const { error: availabilityInsertError } = await supabase
      .from("service_weekly_availability")
      .insert(availabilityRows);

    if (availabilityInsertError) {
      throw new Error("Unable to save the service schedule.");
    }
  }

  if (service.employeeIds.length > 0) {
    const { error: employeesInsertError } = await supabase
      .from("service_employees")
      .insert(
        service.employeeIds.map((employeeId) => ({
          service_id: service.id,
          employee_id: employeeId
        }))
      );

    if (employeesInsertError) {
      throw new Error("Unable to save service assignments.");
    }
  }
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

export async function deleteAppointment(appointmentId: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", appointmentId);

  if (error) {
    throw new Error("Unable to delete the appointment.");
  }
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
  const supabase = getSupabaseBrowserClient();
  const timeZone = getBrowserTimeZone();
  const startsAt = buildIsoInTimeZone(appointment.date, appointment.startTime, timeZone);
  const endsAt = buildIsoInTimeZone(appointment.date, appointment.endTime, timeZone);
  const customerId = await upsertCustomer(supabase, businessId, {
    email: appointment.customerEmail,
    fullName: appointment.customerName,
    phone: appointment.customerPhone
  }, startsAt);

  const { error } = await supabase
    .from("appointments")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      service_id: appointment.serviceId,
      employee_id: appointment.employeeId,
      source: "dashboard",
      status: appointment.status,
      starts_at: startsAt,
      ends_at: endsAt,
      party_size: appointment.partySize,
      unit_price_amount: service.price,
      total_amount: appointment.revenue,
      deposit_amount: service.deposit,
      selected_payment_method: appointment.paymentMethod === "mixed" ? "cash" : appointment.paymentMethod,
      customer_name_snapshot: appointment.customerName,
      customer_email_snapshot: appointment.customerEmail || null,
      customer_phone_snapshot: appointment.customerPhone || null
    });

  if (error) {
    throw new Error("Unable to create the appointment.");
  }
}

export async function savePaymentSettings(businessId: string, settings: BusinessPaymentSettings) {
  return savePaymentSettingsRequest(businessId, settings);
}

async function upsertCustomer(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  businessId: string,
  customer: {
    email: string;
    fullName: string;
    phone: string;
  },
  lastBookedAt: string
) {
  const trimmedEmail = customer.email.trim().toLowerCase();
  const trimmedPhone = customer.phone.trim();
  let customerId: string | null = null;

  if (trimmedEmail) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", businessId)
      .eq("email", trimmedEmail)
      .limit(1)
      .maybeSingle();

    customerId = data?.id ?? null;
  }

  if (!customerId && trimmedPhone) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", businessId)
      .eq("phone", trimmedPhone)
      .limit(1)
      .maybeSingle();

    customerId = data?.id ?? null;
  }

  const payload = {
    business_id: businessId,
    full_name: customer.fullName,
    email: trimmedEmail || null,
    phone: trimmedPhone || null,
    notes: "",
    last_booked_at: lastBookedAt
  };

  if (customerId) {
    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", customerId);

    if (error) {
      throw new Error("Unable to update the customer.");
    }

    return customerId;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Unable to create the customer.");
  }

  return data.id;
}

function buildSlug(name: string, fallbackId: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallbackId;
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
