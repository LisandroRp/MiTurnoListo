import { NextRequest, NextResponse } from "next/server";

import {
  getAvailablePaymentOptions,
  getAvailableSlotsForEmployee
} from "@/features/booking-flow/utils/booking";
import { freePlanLimits, getCurrentMonthRange, isFreePlan } from "@/features/scheduling/plan-limits";
import { AppointmentStatus, PaymentMethod, ServiceAddon } from "@/features/scheduling/types";
import { sendBookingCreatedEmails } from "@/lib/email/booking-emails";
import { createMercadoPagoPreference, getMercadoPagoPublicOrigin } from "@/lib/mercadopago/checkout";
import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import {
  mapAppointments,
  mapEmployees,
  mapPaymentSettings,
  mapServices
} from "@/lib/networking/mappers/scheduling";
import { buildIsoInTimeZone } from "@/lib/networking/utils/date-time";
import { notifyPlanLimitReached } from "@/lib/notifications/plan-limits";

type RouteContext = {
  params: Promise<{
    serviceId: string;
  }>;
};

export async function GET(_: NextRequest, context: RouteContext) {
  const { serviceId } = await context.params;
  const supabase = getSupabaseAdminClient();
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, business_id, name, description, image_url, price_amount, deposit_amount, duration_minutes, capacity, reservation_lead_minutes, cancellation_lead_minutes, payment_mode, is_public")
    .eq("id", serviceId)
    .eq("is_active", true)
    .eq("is_public", true)
    .limit(1)
    .maybeSingle();

  if (serviceError || !service) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  const businessId = service.business_id;
  const [
    businessResult,
    membershipResult,
    serviceEmployeesResult,
    serviceAvailabilityResult,
    employeesResult,
    employeeAvailabilityResult,
    appointmentsResult,
    paymentSettingsResult,
    serviceAddonsResult
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("name, timezone, subscription_tier")
      .eq("id", businessId)
      .limit(1)
      .single(),
    supabase
      .from("business_memberships")
      .select("locale, theme")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("service_employees")
      .select("service_id, employee_id")
      .eq("service_id", service.id),
    supabase
      .from("service_weekly_availability")
      .select("id, service_id, weekday, start_time, end_time")
      .eq("service_id", service.id),
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
      .from("appointments")
      .select("id, service_id, employee_id, starts_at, ends_at, status, total_amount, selected_payment_method, party_size, customer_name_snapshot, customer_email_snapshot, customer_phone_snapshot")
      .eq("business_id", businessId)
      .in("status", ["pending", "confirmed"] satisfies AppointmentStatus[]),
    supabase
      .from("business_payment_settings")
      .select("allow_mercadopago, mercadopago_public_key, transfer_account_holder, transfer_cbu, transfer_alias, transfer_receipt_whatsapp")
      .eq("business_id", businessId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("service_addons")
      .select("id, service_id, name, price_amount, is_active, sort_order")
      .eq("service_id", service.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
  ]);

  if (
    businessResult.error ||
    membershipResult.error ||
    serviceEmployeesResult.error ||
    serviceAvailabilityResult.error ||
    employeesResult.error ||
    employeeAvailabilityResult.error ||
    appointmentsResult.error ||
    paymentSettingsResult.error ||
    serviceAddonsResult.error
  ) {
    return NextResponse.json({ error: "Unable to load booking data." }, { status: 500 });
  }

  const limitResult = await getMonthlyAppointmentLimitStatus(
    supabase,
    businessId,
    businessResult.data.subscription_tier
  );

  if ("response" in limitResult) {
    return limitResult.response;
  }

  const assignedEmployeeIds = (serviceEmployeesResult.data ?? []).map((row) => row.employee_id);
  const employees = mapEmployees(
    (employeesResult.data ?? []).filter((employee) => assignedEmployeeIds.includes(employee.id)),
    (employeeAvailabilityResult.data ?? []).filter((row) => assignedEmployeeIds.includes(row.employee_id))
  );
  const serviceModel = mapServices(
    [service],
    serviceEmployeesResult.data ?? [],
    serviceAvailabilityResult.data ?? [],
    serviceAddonsResult.data ?? []
  )[0];
  const appointments = mapAppointments(
    (appointmentsResult.data ?? []).filter((appointment) => assignedEmployeeIds.includes(appointment.employee_id)),
    businessResult.data.timezone
  ).map((appointment) => ({
    ...appointment,
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    revenue: 0,
    paymentMethod: (appointment.paymentMethod === "mixed" ? "cash" : appointment.paymentMethod) as PaymentMethod
  }));

  return NextResponse.json({
    appointments,
    businessName: businessResult.data.name,
    employees,
    locale: membershipResult.data?.locale ?? "es",
    paymentSettings: mapPaymentSettings(paymentSettingsResult.data),
    service: serviceModel,
    theme: membershipResult.data?.theme ?? "coral"
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { serviceId } = await context.params;
  const payload = await request.json() as {
    customer?: {
      email?: string;
      fullName?: string;
      phone?: string;
    };
    employeeId?: string;
    partySize?: number;
    paymentMethod?: Exclude<PaymentMethod, "mixed">;
    addonIds?: string[];
    timeZone?: string;
    slot?: {
      date?: string;
      endTime?: string;
      startTime?: string;
    };
  };

  if (
    !payload.customer?.fullName?.trim() ||
    !payload.customer.email?.trim() ||
    !isValidEmail(payload.customer.email) ||
    !payload.customer.phone?.trim() ||
    !payload.employeeId ||
    !payload.partySize ||
    !payload.paymentMethod ||
    !payload.timeZone?.trim() ||
    !payload.slot?.date ||
    !payload.slot.startTime ||
    !payload.slot.endTime
  ) {
    return NextResponse.json({ error: "Invalid booking payload." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const customer = {
      email: payload.customer.email.trim().toLowerCase(),
      fullName: payload.customer.fullName.trim(),
      phone: payload.customer.phone.trim()
    };
    const startsAt = buildIsoInTimeZone(payload.slot.date, payload.slot.startTime, payload.timeZone);
    const endsAt = buildIsoInTimeZone(payload.slot.date, payload.slot.endTime, payload.timeZone);
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, business_id, name, description, image_url, price_amount, deposit_amount, duration_minutes, capacity, reservation_lead_minutes, cancellation_lead_minutes, payment_mode, is_public")
      .eq("id", serviceId)
      .eq("is_active", true)
      .eq("is_public", true)
      .limit(1)
      .maybeSingle();

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

    const [
      businessResult,
      serviceEmployeesResult,
      serviceAvailabilityResult,
      employeeResult,
      employeeAvailabilityResult,
      appointmentsResult,
      paymentSettingsResult,
      serviceAddonsResult
    ] = await Promise.all([
      supabase
        .from("businesses")
        .select("timezone, subscription_tier")
        .eq("id", service.business_id)
        .limit(1)
        .single(),
      supabase
        .from("service_employees")
        .select("service_id, employee_id")
        .eq("service_id", service.id),
      supabase
        .from("service_weekly_availability")
        .select("id, service_id, weekday, start_time, end_time")
        .eq("service_id", service.id),
      supabase
        .from("employees")
        .select("id, name, role, description, image_url, color_token")
        .eq("business_id", service.business_id)
        .eq("id", payload.employeeId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("employee_weekly_availability")
        .select("id, employee_id, weekday, start_time, end_time")
        .eq("employee_id", payload.employeeId),
      supabase
        .from("appointments")
        .select("id, service_id, employee_id, starts_at, ends_at, status, total_amount, selected_payment_method, party_size, customer_name_snapshot, customer_email_snapshot, customer_phone_snapshot")
        .eq("business_id", service.business_id)
        .eq("employee_id", payload.employeeId)
        .in("status", ["pending", "confirmed"] satisfies AppointmentStatus[]),
      supabase
        .from("business_payment_settings")
        .select("allow_mercadopago, mercadopago_public_key, mercadopago_access_token, transfer_account_holder, transfer_cbu, transfer_alias, transfer_receipt_whatsapp")
        .eq("business_id", service.business_id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("service_addons")
        .select("id, service_id, name, price_amount, is_active, sort_order")
        .eq("service_id", service.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
    ]);

    if (
      businessResult.error ||
      serviceEmployeesResult.error ||
      serviceAvailabilityResult.error ||
      employeeResult.error ||
      employeeAvailabilityResult.error ||
      appointmentsResult.error ||
      paymentSettingsResult.error ||
      serviceAddonsResult.error ||
      !employeeResult.data
    ) {
      return NextResponse.json({ error: "Unable to validate the booking." }, { status: 500 });
    }

    const limitResult = await getMonthlyAppointmentLimitStatus(
      supabase,
      service.business_id,
      businessResult.data.subscription_tier
    );

    if ("response" in limitResult) {
      return limitResult.response;
    }

    const assignedEmployeeIds = (serviceEmployeesResult.data ?? []).map((row) => row.employee_id);

    if (!assignedEmployeeIds.includes(payload.employeeId)) {
      return NextResponse.json({ error: "The selected professional is not available for this service." }, { status: 400 });
    }

    const employee = mapEmployees(
      [employeeResult.data],
      employeeAvailabilityResult.data ?? []
    )[0];
    const serviceModel = mapServices(
      [service],
      serviceEmployeesResult.data ?? [],
      serviceAvailabilityResult.data ?? [],
      serviceAddonsResult.data ?? []
    )[0];

    if (!employee || !serviceModel) {
      return NextResponse.json({ error: "Unable to validate the booking." }, { status: 500 });
    }

    const appointments = mapAppointments(
      appointmentsResult.data ?? [],
      businessResult.data.timezone
    );
    const paymentSettings = mapPaymentSettings(paymentSettingsResult.data);
    const availablePaymentOptions = getAvailablePaymentOptions(serviceModel, paymentSettings);
    const requestedPaymentOption = mapPaymentMethodToOption(payload.paymentMethod);

    if (!availablePaymentOptions.includes(requestedPaymentOption)) {
      return NextResponse.json({ error: "The selected payment method is not available for this service." }, { status: 400 });
    }

    const availableSlots = getAvailableSlotsForEmployee(
      serviceModel,
      employee,
      appointments,
      new Date(`${payload.slot.date}T12:00:00`),
      payload.partySize
    );
    const selectedSlot = availableSlots.find((slot) => (
      slot.date === payload.slot?.date &&
      slot.startTime === payload.slot?.startTime &&
      slot.endTime === payload.slot?.endTime
    ));

    if (!selectedSlot) {
      return NextResponse.json({ error: "The selected time is no longer available." }, { status: 409 });
    }

    const appointmentId = crypto.randomUUID();
    const selectedAddonIds = new Set((payload.addonIds ?? []).filter((addonId) => typeof addonId === "string"));
    const selectedAddons = serviceModel.addons.filter((addon) => selectedAddonIds.has(addon.id));
    const addonsAmount = selectedAddons.reduce((total, addon) => total + addon.price, 0);
    const totalAmount = service.price_amount + addonsAmount;

    if (payload.paymentMethod === "card") {
      const accessToken = paymentSettingsResult.data?.mercadopago_access_token?.trim();

      if (!accessToken) {
        return NextResponse.json({ error: "Mercado Pago is not configured for this business." }, { status: 409 });
      }

      const checkoutAmount = service.deposit_amount > 0 ? service.deposit_amount : totalAmount;
      const preference = await createMercadoPagoPreference({
        accessToken,
        amount: checkoutAmount,
        appointmentId,
        customer,
        origin: getMercadoPagoPublicOrigin(request.nextUrl.origin),
        serviceName: service.name
      });
      const customerId = await upsertCustomer(
        supabase,
        service.business_id,
        customer,
        startsAt
      );
      const { error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          id: appointmentId,
          business_id: service.business_id,
          customer_id: customerId,
          service_id: serviceId,
          employee_id: payload.employeeId,
          source: "public",
          status: "pending",
          starts_at: startsAt,
          ends_at: endsAt,
          party_size: payload.partySize,
          unit_price_amount: service.price_amount,
          total_amount: totalAmount,
          deposit_amount: service.deposit_amount,
          selected_payment_method: payload.paymentMethod,
          customer_name_snapshot: customer.fullName,
          customer_email_snapshot: customer.email,
          customer_phone_snapshot: customer.phone,
          notes: ""
        });

      if (appointmentError) {
        return NextResponse.json({ error: "Unable to create the booking." }, { status: 500 });
      }

      await insertAppointmentAddons(supabase, appointmentId, selectedAddons);
      await sendBookingCreatedEmails({ appointmentId });

      return NextResponse.json({
        appointmentId,
        checkoutUrl: preference.checkoutUrl
      });
    }

    const customerId = await upsertCustomer(
      supabase,
      service.business_id,
      customer,
      startsAt
    );
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        id: appointmentId,
        business_id: service.business_id,
        customer_id: customerId,
        service_id: serviceId,
        employee_id: payload.employeeId,
        source: "public",
        status: "pending",
        starts_at: startsAt,
        ends_at: endsAt,
        party_size: payload.partySize,
        unit_price_amount: service.price_amount,
        total_amount: totalAmount,
        deposit_amount: service.deposit_amount,
        selected_payment_method: payload.paymentMethod,
        customer_name_snapshot: customer.fullName,
        customer_email_snapshot: customer.email,
        customer_phone_snapshot: customer.phone,
        notes: ""
      })
      .select("id")
      .single();

    if (appointmentError || !appointment) {
      return NextResponse.json({ error: "Unable to create the booking." }, { status: 500 });
    }

    await insertAppointmentAddons(supabase, appointment.id, selectedAddons);
    await sendBookingCreatedEmails({ appointmentId: appointment.id });

    return NextResponse.json({
      appointmentId: appointment.id
    });
  } catch (error) {
    return createApiErrorResponse(error, {
      code: "BOOKING_CREATE_FAILED",
      fallbackMessage: "Unable to create the booking.",
      status: 500
    });
  }
}

async function upsertCustomer(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  businessId: string,
  customer: {
    email: string;
    fullName: string;
    phone: string;
  },
  lastBookedAt: string
) {
  const email = customer.email.trim().toLowerCase();
  const phone = customer.phone.trim();
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id")
    .eq("business_id", businessId)
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (existingCustomer?.id) {
    await supabase
      .from("customers")
      .update({
        full_name: customer.fullName.trim(),
        phone,
        last_booked_at: lastBookedAt
      })
      .eq("id", existingCustomer.id);

    return existingCustomer.id;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: businessId,
      full_name: customer.fullName.trim(),
      email,
      phone,
      notes: "",
      last_booked_at: lastBookedAt
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Unable to create the customer.");
  }

  return data.id;
}

async function insertAppointmentAddons(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  appointmentId: string,
  addons: ServiceAddon[]
) {
  if (addons.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("appointment_addons")
    .insert(addons.map((addon) => ({
      appointment_id: appointmentId,
      service_addon_id: addon.id,
      name_snapshot: addon.name,
      price_amount_snapshot: addon.price
    })));

  if (error) {
    throw new Error("Unable to save booking add-ons.");
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function mapPaymentMethodToOption(paymentMethod: Exclude<PaymentMethod, "mixed">) {
  if (paymentMethod === "card") {
    return "mercadoPago";
  }

  return paymentMethod;
}

async function getMonthlyAppointmentLimitStatus(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  businessId: string,
  subscriptionTier: string
) {
  if (!isFreePlan(subscriptionTier)) {
    return { canBook: true };
  }

  const { start, end } = getCurrentMonthRange();
  const { count, error } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .neq("status", "cancelled")
    .gte("starts_at", start)
    .lt("starts_at", end);

  if (error) {
    return {
      response: NextResponse.json({ error: "Unable to validate booking limits." }, { status: 500 })
    };
  }

  if ((count ?? 0) >= freePlanLimits.monthlyAppointments) {
    await notifyPlanLimitReached({ businessId, limit: "monthlyAppointments" });

    return {
      response: NextResponse.json(
        { error: `Este negocio alcanzo el limite de ${freePlanLimits.monthlyAppointments} turnos mensuales.` },
        { status: 402 }
      )
    };
  }

  return { canBook: true };
}
