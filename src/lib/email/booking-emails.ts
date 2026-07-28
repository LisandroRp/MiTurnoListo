import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { formatCurrency } from "@/features/scheduling/utils/format";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { sendEmail } from "@/lib/email/resend";

type BookingEmailInput = {
  appointmentId: string;
};

type AppointmentEmailContext = {
  appointmentId: string;
  businessId: string;
  businessName: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  employeeName: string;
  serviceName: string;
  startsAt: string;
  totalAmount: number;
};

export async function sendBookingCreatedEmails(input: BookingEmailInput) {
  const context = await getAppointmentEmailContext(input.appointmentId);

  if (!context) {
    return;
  }

  await Promise.all([
    sendEmail({
      html: buildBookingCreatedCustomerHtml(context),
      subject: `Reserva recibida en ${context.businessName}`,
      text: buildBookingCreatedCustomerText(context),
      to: context.customerEmail
    }),
    sendBusinessBookingNotificationEmail(context)
  ]);
}

export async function sendBookingConfirmedEmail(input: BookingEmailInput) {
  const context = await getAppointmentEmailContext(input.appointmentId);

  if (!context) {
    return;
  }

  await sendEmail({
    html: buildBookingConfirmedHtml(context),
    subject: `Turno confirmado en ${context.businessName}`,
    text: buildBookingConfirmedText(context),
    to: context.customerEmail
  });
}

export async function sendPlanLimitReachedEmail({ businessId }: { businessId: string }) {
  const supabase = getSupabaseAdminClient();
  const context = await getBusinessOwnerContext(supabase, businessId);

  if (!context) {
    return;
  }

  await sendEmail({
    html: buildPlanLimitHtml(context.businessName),
    subject: "Llegaste al limite mensual del plan Free",
    text: `Hola, ${context.businessName} llego al limite mensual de turnos del plan Free. Activa Premium para seguir recibiendo reservas online este mes.`,
    to: context.ownerEmail
  });
}

async function sendBusinessBookingNotificationEmail(context: AppointmentEmailContext) {
  const supabase = getSupabaseAdminClient();
  const ownerContext = await getBusinessOwnerContext(supabase, context.businessId);

  if (!ownerContext) {
    return;
  }

  await sendEmail({
    html: buildBusinessNotificationHtml(context),
    replyTo: context.customerEmail,
    subject: `Nueva reserva: ${context.serviceName}`,
    text: buildBusinessNotificationText(context),
    to: ownerContext.ownerEmail
  });
}

async function getAppointmentEmailContext(appointmentId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, business_id, employee_id, service_id, starts_at, total_amount, customer_name_snapshot, customer_email_snapshot, customer_phone_snapshot")
    .eq("id", appointmentId)
    .limit(1)
    .maybeSingle();

  if (error || !appointment?.customer_email_snapshot) {
    return null;
  }

  const [businessResult, employeeResult, serviceResult] = await Promise.all([
    supabase
      .from("businesses")
      .select("name")
      .eq("id", appointment.business_id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("employees")
      .select("name")
      .eq("id", appointment.employee_id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("services")
      .select("name")
      .eq("id", appointment.service_id)
      .limit(1)
      .maybeSingle()
  ]);

  if (businessResult.error || employeeResult.error || serviceResult.error) {
    return null;
  }

  return {
    appointmentId: appointment.id,
    businessId: appointment.business_id,
    businessName: businessResult.data?.name ?? "MiTurnoListo",
    customerEmail: appointment.customer_email_snapshot,
    customerName: appointment.customer_name_snapshot,
    customerPhone: appointment.customer_phone_snapshot ?? "",
    employeeName: employeeResult.data?.name ?? "",
    serviceName: serviceResult.data?.name ?? "Servicio",
    startsAt: appointment.starts_at,
    totalAmount: appointment.total_amount
  } satisfies AppointmentEmailContext;
}

async function getBusinessOwnerContext(supabase: SupabaseClient, businessId: string) {
  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .limit(1)
    .maybeSingle();
  const { data: membership } = await supabase
    .from("business_memberships")
    .select("user_id")
    .eq("business_id", businessId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (!membership?.user_id) {
    return null;
  }

  const {
    data: { user }
  } = await supabase.auth.admin.getUserById(membership.user_id);

  if (!user?.email) {
    return null;
  }

  return {
    businessName: business?.name ?? "MiTurnoListo",
    ownerEmail: user.email
  };
}

function formatAppointmentDate(startsAt: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(new Date(startsAt));
}

function buildBookingCreatedCustomerText(context: AppointmentEmailContext) {
  return `Hola ${context.customerName}, recibimos tu reserva para ${context.serviceName} en ${context.businessName}. Fecha: ${formatAppointmentDate(context.startsAt)}. Profesional: ${context.employeeName}.`;
}

function buildBookingCreatedCustomerHtml(context: AppointmentEmailContext) {
  return buildEmailShell({
    body: `
      <p>Hola ${escapeHtml(context.customerName)},</p>
      <p>Recibimos tu reserva para <strong>${escapeHtml(context.serviceName)}</strong> en ${escapeHtml(context.businessName)}.</p>
      ${buildAppointmentDetails(context)}
      <p>El negocio va a confirmar el turno o el pago segun corresponda.</p>
    `,
    title: "Reserva recibida"
  });
}

function buildBookingConfirmedText(context: AppointmentEmailContext) {
  return `Hola ${context.customerName}, tu turno en ${context.businessName} quedo confirmado. Servicio: ${context.serviceName}. Fecha: ${formatAppointmentDate(context.startsAt)}.`;
}

function buildBookingConfirmedHtml(context: AppointmentEmailContext) {
  return buildEmailShell({
    body: `
      <p>Hola ${escapeHtml(context.customerName)},</p>
      <p>Tu turno en ${escapeHtml(context.businessName)} quedo <strong>confirmado</strong>.</p>
      ${buildAppointmentDetails(context)}
    `,
    title: "Turno confirmado"
  });
}

function buildBusinessNotificationText(context: AppointmentEmailContext) {
  return `Nueva reserva para ${context.serviceName}. Cliente: ${context.customerName}. Fecha: ${formatAppointmentDate(context.startsAt)}. Telefono: ${context.customerPhone}.`;
}

function buildBusinessNotificationHtml(context: AppointmentEmailContext) {
  return buildEmailShell({
    body: `
      <p>Tenes una nueva reserva para <strong>${escapeHtml(context.serviceName)}</strong>.</p>
      ${buildAppointmentDetails(context)}
      <p><strong>Cliente:</strong> ${escapeHtml(context.customerName)}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(context.customerPhone || "-")}</p>
      <p><strong>Email:</strong> ${escapeHtml(context.customerEmail)}</p>
    `,
    title: "Nueva reserva"
  });
}

function buildPlanLimitHtml(businessName: string) {
  return buildEmailShell({
    body: `
      <p>${escapeHtml(businessName)} llego al limite mensual de turnos del plan Free.</p>
      <p>Activa Premium para seguir recibiendo reservas online este mes.</p>
    `,
    title: "Limite Free alcanzado"
  });
}

function buildAppointmentDetails(context: AppointmentEmailContext) {
  return `
    <ul>
      <li><strong>Fecha:</strong> ${escapeHtml(formatAppointmentDate(context.startsAt))}</li>
      <li><strong>Profesional:</strong> ${escapeHtml(context.employeeName || "-")}</li>
      <li><strong>Total:</strong> ${escapeHtml(formatCurrency(context.totalAmount))}</li>
    </ul>
  `;
}

function buildEmailShell({ body, title }: { body: string; title: string }) {
  return `
    <div style="font-family: Arial, sans-serif; color: #18212f; line-height: 1.6;">
      <h1 style="font-size: 24px;">${escapeHtml(title)}</h1>
      ${body}
      <p style="margin-top: 24px; color: #607089;">MiTurnoListo</p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
