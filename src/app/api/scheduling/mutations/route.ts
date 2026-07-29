import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { Appointment, Employee, Service } from "@/features/scheduling/types";
import { freePlanLimits, getCurrentMonthRange, isFreePlan } from "@/features/scheduling/plan-limits";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { mapScheduleToAvailabilityRows } from "@/lib/networking/mappers/scheduling";
import { buildIsoInTimeZone } from "@/lib/networking/utils/date-time";
import { sendBookingCancelledEmails } from "@/lib/email/booking-emails";
import { refundMercadoPagoPayment } from "@/lib/mercadopago/checkout";
import { notifyPlanLimitReached } from "@/lib/notifications/plan-limits";

type SchedulingMutationPayload =
  | {
      action: "saveEmployee";
      businessId: string;
      employee: Employee;
    }
  | {
      action: "saveService";
      businessId: string;
      service: Service;
    }
  | {
      action: "createAppointment";
      businessId: string;
      appointment: Appointment;
      service: Service;
      timeZone: string;
    }
  | {
      action: "cancelAppointment";
      appointmentId: string;
      businessId: string;
    }
  | {
      action: "markAppointmentPaid";
      appointmentId: string;
      businessId: string;
    };

type BusinessContext = {
  subscriptionTier: string;
};

export async function POST(request: NextRequest) {
  const payload = await request.json() as SchedulingMutationPayload;

  if (!payload.businessId) {
    return NextResponse.json({ error: "Missing business id." }, { status: 400 });
  }

  const authResult = await authenticateRequest(request, payload.businessId);

  if ("response" in authResult) {
    return authResult.response;
  }

  const supabase = getSupabaseAdminClient();
  const contextResult = await getBusinessContext(supabase, payload.businessId);

  if ("response" in contextResult) {
    return contextResult.response;
  }

  try {
    if (payload.action === "saveEmployee") {
      await enforceEmployeeLimit(supabase, payload.businessId, payload.employee.id, contextResult.context);
      await saveEmployee(supabase, payload.businessId, payload.employee);
    }

    if (payload.action === "saveService") {
      await enforceVisibleServiceLimit(supabase, payload.businessId, payload.service, contextResult.context);
      await enforceServicePaymentConfiguration(supabase, payload.businessId, payload.service);
      await saveService(supabase, payload.businessId, payload.service);
    }

    if (payload.action === "createAppointment") {
      await enforceMonthlyAppointmentLimit(supabase, payload.businessId, contextResult.context);
      await createAppointment(supabase, payload.businessId, payload.appointment, payload.service, payload.timeZone);
    }

    if (payload.action === "cancelAppointment") {
      await cancelAppointment(supabase, payload.businessId, payload.appointmentId);
    }

    if (payload.action === "markAppointmentPaid") {
      await markAppointmentPaid(supabase, payload.businessId, payload.appointmentId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save changes.";
    const status = message.startsWith("PLAN_LIMIT:") ? 402 : message.startsWith("PAYMENT_CONFIG:") ? 409 : 500;

    return NextResponse.json({ error: message.replace(/^(PLAN_LIMIT|PAYMENT_CONFIG):/, "") }, { status });
  }
}

async function authenticateRequest(request: NextRequest, businessId: string) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return {
      response: NextResponse.json({ error: "Missing authorization token." }, { status: 401 })
    };
  }

  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      response: NextResponse.json({ error: "Invalid session." }, { status: 401 })
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("business_memberships")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return {
      response: NextResponse.json({ error: "Membership not found." }, { status: 403 })
    };
  }

  if (!["owner", "admin"].includes(membership.role)) {
    return {
      response: NextResponse.json({ error: "Insufficient permissions." }, { status: 403 })
    };
  }

  return { userId: user.id };
}

async function getBusinessContext(supabase: SupabaseClient, businessId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("subscription_tier, timezone")
    .eq("id", businessId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      response: NextResponse.json({ error: "Business not found." }, { status: 404 })
    };
  }

  return {
    context: {
      subscriptionTier: data.subscription_tier
    } satisfies BusinessContext
  };
}

async function enforceEmployeeLimit(
  supabase: SupabaseClient,
  businessId: string,
  employeeId: string,
  context: BusinessContext
) {
  if (!isFreePlan(context.subscriptionTier)) {
    return;
  }

  const { count, error } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("is_active", true)
    .neq("id", employeeId);

  if (error) {
    throw new Error("Unable to validate employee limit.");
  }

  if ((count ?? 0) >= freePlanLimits.activeEmployees) {
    throw new Error(`PLAN_LIMIT:El plan Free permite hasta ${freePlanLimits.activeEmployees} empleados activos.`);
  }
}

async function enforceVisibleServiceLimit(
  supabase: SupabaseClient,
  businessId: string,
  service: Service,
  context: BusinessContext
) {
  if (!isFreePlan(context.subscriptionTier) || !service.isVisible) {
    return;
  }

  const { count, error } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("is_active", true)
    .eq("is_public", true)
    .neq("id", service.id);

  if (error) {
    throw new Error("Unable to validate visible service limit.");
  }

  if ((count ?? 0) >= freePlanLimits.visibleServices) {
    throw new Error(`PLAN_LIMIT:El plan Free permite hasta ${freePlanLimits.visibleServices} servicios visibles.`);
  }
}

async function enforceMonthlyAppointmentLimit(
  supabase: SupabaseClient,
  businessId: string,
  context: BusinessContext
) {
  if (!isFreePlan(context.subscriptionTier)) {
    return;
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
    throw new Error("Unable to validate monthly appointment limit.");
  }

  if ((count ?? 0) >= freePlanLimits.monthlyAppointments) {
    await notifyPlanLimitReached({ businessId, limit: "monthlyAppointments" });
    throw new Error(`PLAN_LIMIT:El plan Free permite hasta ${freePlanLimits.monthlyAppointments} turnos por mes.`);
  }
}

async function enforceServicePaymentConfiguration(
  supabase: SupabaseClient,
  businessId: string,
  service: Service
) {
  if (service.paymentMethod !== "card" && service.paymentMethod !== "mixed") {
    return;
  }

  const { data, error } = await supabase
    .from("business_payment_settings")
    .select("allow_mercadopago")
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to validate Mercado Pago settings.");
  }

  if (!data?.allow_mercadopago) {
    throw new Error("PAYMENT_CONFIG:Configura Mercado Pago antes de usarlo como metodo de pago del servicio.");
  }
}

async function saveEmployee(supabase: SupabaseClient, businessId: string, employee: Employee) {
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
      is_active: true
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

async function saveService(supabase: SupabaseClient, businessId: string, service: Service) {
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

async function createAppointment(
  supabase: SupabaseClient,
  businessId: string,
  appointment: Appointment,
  service: Service,
  timeZone: string
) {
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

async function cancelAppointment(supabase: SupabaseClient, businessId: string, appointmentId: string) {
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, business_id, mercadopago_payment_id, refunded_at, selected_payment_method, status")
    .eq("id", appointmentId)
    .limit(1)
    .maybeSingle();

  if (appointmentError || !appointment || appointment.business_id !== businessId) {
    throw new Error("Unable to find the appointment.");
  }

  if (appointment.status === "cancelled") {
    return;
  }

  const shouldRefundMercadoPago = Boolean(
    appointment.selected_payment_method === "card" &&
    appointment.mercadopago_payment_id &&
    !appointment.refunded_at
  );
  const refundedAt = shouldRefundMercadoPago ? new Date().toISOString() : null;

  if (shouldRefundMercadoPago && appointment.mercadopago_payment_id) {
    await refundMercadoPagoPayment({
      businessId,
      paymentId: appointment.mercadopago_payment_id
    });
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      ...(refundedAt ? { refunded_at: refundedAt } : {})
    })
    .eq("id", appointmentId);

  if (updateError) {
    throw new Error("Unable to cancel the appointment.");
  }

  await sendBookingCancelledEmails({
    appointmentId,
    wasRefunded: shouldRefundMercadoPago
  });
}

async function markAppointmentPaid(supabase: SupabaseClient, businessId: string, appointmentId: string) {
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, business_id, status")
    .eq("id", appointmentId)
    .limit(1)
    .maybeSingle();

  if (appointmentError || !appointment || appointment.business_id !== businessId) {
    throw new Error("Unable to find the appointment.");
  }

  if (appointment.status === "cancelled") {
    throw new Error("Unable to mark a cancelled appointment as paid.");
  }

  if (appointment.status === "confirmed") {
    return;
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "confirmed" })
    .eq("id", appointmentId);

  if (updateError) {
    throw new Error("Unable to mark the appointment as paid.");
  }
}

async function upsertCustomer(
  supabase: SupabaseClient,
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
