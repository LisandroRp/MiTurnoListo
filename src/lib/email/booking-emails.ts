import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { bookingCancellationEmail } from "@/emails/templates/booking-cancellation";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";
import { businessBookingCancellationEmail } from "@/emails/templates/business-booking-cancellation";
import { businessBookingNotificationEmail } from "@/emails/templates/business-booking-notification";
import { businessPaymentConfirmedEmail } from "@/emails/templates/business-payment-confirmed";
import { planLimitReachedEmail } from "@/emails/templates/plan-limit-reached";
import { formatCurrency } from "@/features/scheduling/utils/format";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { sendEmail } from "@/lib/email/resend";

type BookingEmailInput = {
  appointmentId: string;
};

type BookingCancellationEmailInput = BookingEmailInput & {
  cancellationReason: string;
  wasRefunded: boolean;
};

type AppointmentEmailContext = {
  appointmentId: string;
  businessId: string;
  businessName: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  cancellationReason: string;
  employeeName: string;
  paymentMethod: string | null;
  publicCancelToken: string;
  receiptWhatsapp: string;
  cancellationLeadMinutes: number;
  serviceName: string;
  startsAt: string;
  totalAmount: number;
};

export async function sendBookingCreatedEmails(input: BookingEmailInput) {
  const context = await getAppointmentEmailContext(input.appointmentId);

  if (!context) {
    return;
  }

  const results = await Promise.all([
    sendEmail({
      html: bookingConfirmationEmail({
        appointmentDate: formatAppointmentDateOnly(context.startsAt),
        appointmentTime: formatAppointmentTimeOnly(context.startsAt),
        businessName: context.businessName,
        customerName: context.customerName,
        employeeName: context.employeeName,
        manageBookingUrl: buildCancellationUrl(context.publicCancelToken),
        serviceName: context.serviceName
      }),
      subject: `Tu reserva en ${context.businessName} fue recibida`,
      text: buildBookingCreatedCustomerText(context),
      to: context.customerEmail
    })
  ]);
  logSkippedEmailResults(results);
}

export async function sendBookingConfirmedEmails(input: BookingEmailInput) {
  const context = await getAppointmentEmailContext(input.appointmentId);

  if (!context) {
    return;
  }

  const results = await Promise.all([
    sendEmail({
      html: bookingConfirmationEmail({
        appointmentDate: formatAppointmentDateOnly(context.startsAt),
        appointmentTime: formatAppointmentTimeOnly(context.startsAt),
        businessName: context.businessName,
        customerName: context.customerName,
        employeeName: context.employeeName,
        manageBookingUrl: buildCancellationUrl(context.publicCancelToken),
        serviceName: context.serviceName
      }),
      subject: `Turno confirmado en ${context.businessName}`,
      text: buildBookingConfirmedText(context),
      to: context.customerEmail
    })
  ]);
  logSkippedEmailResults(results);
}

export async function sendBookingCancelledEmails(input: BookingCancellationEmailInput) {
  const context = await getAppointmentEmailContext(input.appointmentId);

  if (!context) {
    return;
  }

  const cancellationReason = input.cancellationReason.trim() || context.cancellationReason;
  const results = await Promise.all([
    sendEmail({
      html: bookingCancellationEmail({
        appointmentDateTime: formatAppointmentDate(context.startsAt),
        businessName: context.businessName,
        cancellationReason,
        customerName: context.customerName,
        employeeName: context.employeeName,
        serviceName: context.serviceName,
        totalAmount: formatCurrency(context.totalAmount),
        wasRefunded: input.wasRefunded
      }),
      subject: `Turno cancelado en ${context.businessName}`,
      text: buildBookingCancelledCustomerText(context, cancellationReason, input.wasRefunded),
      to: context.customerEmail
    })
  ]);
  logSkippedEmailResults(results);
}


export async function sendPlanLimitReachedEmail({ businessId }: { businessId: string }) {
  const supabase = getSupabaseAdminClient();
  const context = await getBusinessOwnerContext(supabase, businessId);

  if (!context) {
    return;
  }

  const result = await sendEmail({
    html: planLimitReachedEmail({ businessName: context.businessName }),
    subject: "Llegaste al limite mensual del plan Free",
    text: `Hola, ${context.businessName} llego al limite mensual de turnos del plan Free. Activa Premium para seguir recibiendo reservas online este mes.`,
    to: context.ownerEmail
  });
  logSkippedEmailResults([result]);
}

async function sendBusinessBookingNotificationEmail(context: AppointmentEmailContext) {
  const supabase = getSupabaseAdminClient();
  const ownerContext = await getBusinessOwnerContext(supabase, context.businessId);

  if (!ownerContext) {
    return;
  }

  return sendEmail({
    html: businessBookingNotificationEmail({
      appointmentDateTime: formatAppointmentDate(context.startsAt),
      businessName: context.businessName,
      customerEmail: context.customerEmail,
      customerName: context.customerName,
      customerPhone: context.customerPhone,
      employeeName: context.employeeName,
      receiptWhatsapp: context.paymentMethod === "transfer" ? context.receiptWhatsapp : "",
      serviceName: context.serviceName,
      totalAmount: formatCurrency(context.totalAmount)
    }),
    replyTo: context.customerEmail,
    subject: `Nueva reserva: ${context.serviceName}`,
    text: buildBusinessNotificationText(context),
    to: ownerContext.ownerEmail
  });
}

async function sendBusinessPaymentConfirmedEmail(context: AppointmentEmailContext) {
  const supabase = getSupabaseAdminClient();
  const ownerContext = await getBusinessOwnerContext(supabase, context.businessId);

  if (!ownerContext) {
    return;
  }

  return sendEmail({
    html: businessPaymentConfirmedEmail({
      appointmentDateTime: formatAppointmentDate(context.startsAt),
      businessName: context.businessName,
      customerEmail: context.customerEmail,
      customerName: context.customerName,
      customerPhone: context.customerPhone,
      employeeName: context.employeeName,
      serviceName: context.serviceName,
      totalAmount: formatCurrency(context.totalAmount)
    }),
    replyTo: context.customerEmail,
    subject: `Pago confirmado: ${context.serviceName}`,
    text: buildBusinessPaymentConfirmedText(context),
    to: ownerContext.ownerEmail
  });
}

async function sendBusinessBookingCancelledEmail(context: AppointmentEmailContext, wasRefunded: boolean) {
  const supabase = getSupabaseAdminClient();
  const ownerContext = await getBusinessOwnerContext(supabase, context.businessId);

  if (!ownerContext) {
    return;
  }

  return sendEmail({
    html: businessBookingCancellationEmail({
      appointmentDateTime: formatAppointmentDate(context.startsAt),
      businessName: context.businessName,
      cancellationReason: context.cancellationReason,
      customerEmail: context.customerEmail,
      customerName: context.customerName,
      customerPhone: context.customerPhone,
      employeeName: context.employeeName,
      serviceName: context.serviceName,
      totalAmount: formatCurrency(context.totalAmount),
      wasRefunded
    }),
    replyTo: context.customerEmail,
    subject: `Turno cancelado: ${context.serviceName}`,
    text: buildBusinessBookingCancelledText(context, wasRefunded),
    to: ownerContext.ownerEmail
  });
}

function logSkippedEmailResults(results: Array<Awaited<ReturnType<typeof sendEmail>> | undefined>) {
  for (const result of results) {
    if (result?.status === "skipped") {
      console.warn(`[email] ${result.reason}`);
    }
  }
}


async function getAppointmentEmailContext(appointmentId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id, business_id, employee_id, service_id, starts_at, total_amount, selected_payment_method, public_cancel_token, customer_name_snapshot, customer_email_snapshot, customer_phone_snapshot, cancellation_reason")
    .eq("id", appointmentId)
    .limit(1)
    .maybeSingle();

  if (error || !appointment?.customer_email_snapshot) {
    return null;
  }

  const [businessResult, employeeResult, serviceResult, paymentSettingsResult] = await Promise.all([
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
      .select("name, cancellation_lead_minutes")
      .eq("id", appointment.service_id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("business_payment_settings")
      .select("transfer_receipt_whatsapp")
      .eq("business_id", appointment.business_id)
      .limit(1)
      .maybeSingle()
  ]);

  if (businessResult.error || employeeResult.error || serviceResult.error || paymentSettingsResult.error) {
    return null;
  }

  return {
    appointmentId: appointment.id,
    businessId: appointment.business_id,
    businessName: businessResult.data?.name ?? "MiTurnoListo",
    customerEmail: appointment.customer_email_snapshot,
    customerName: appointment.customer_name_snapshot,
    customerPhone: appointment.customer_phone_snapshot ?? "",
    cancellationReason: appointment.cancellation_reason ?? "",
    employeeName: employeeResult.data?.name ?? "",
    paymentMethod: appointment.selected_payment_method,
    publicCancelToken: appointment.public_cancel_token,
    receiptWhatsapp: paymentSettingsResult.data?.transfer_receipt_whatsapp ?? "",
    cancellationLeadMinutes: serviceResult.data?.cancellation_lead_minutes ?? 1440,
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

function formatAppointmentDateOnly(startsAt: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(new Date(startsAt));
}

function formatAppointmentTimeOnly(startsAt: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(new Date(startsAt));
}

function buildBookingCreatedCustomerText(context: AppointmentEmailContext) {
  return `Hola ${context.customerName}, recibimos tu reserva para ${context.serviceName} en ${context.businessName}. Fecha: ${formatAppointmentDate(context.startsAt)}. Profesional: ${context.employeeName}.${buildTransferReceiptText(context)} ${buildCancellationText(context)}`;
}

function buildBookingConfirmedText(context: AppointmentEmailContext) {
  return `Hola ${context.customerName}, tu turno en ${context.businessName} quedo confirmado. Servicio: ${context.serviceName}. Fecha: ${formatAppointmentDate(context.startsAt)}. ${buildCancellationText(context)}`;
}

function buildBookingCancelledCustomerText(context: AppointmentEmailContext, cancellationReason: string, wasRefunded: boolean) {
  const refundText = wasRefunded
    ? " Si habias pagado con Mercado Pago, el reembolso fue solicitado correctamente."
    : "";
  const reasonText = cancellationReason.trim()
    ? ` Motivo de cancelacion: ${cancellationReason.trim()}.`
    : "";

  return `Hola ${context.customerName}, tu turno en ${context.businessName} fue cancelado. Servicio: ${context.serviceName}. Fecha: ${formatAppointmentDate(context.startsAt)}.${reasonText}${refundText}`;
}

function buildBusinessNotificationText(context: AppointmentEmailContext) {
  return `Nueva reserva para ${context.serviceName}. Cliente: ${context.customerName}. Fecha: ${formatAppointmentDate(context.startsAt)}. Telefono: ${context.customerPhone}.${buildTransferReceiptText(context)}`;
}

function buildBusinessPaymentConfirmedText(context: AppointmentEmailContext) {
  return `Pago confirmado por Mercado Pago para ${context.serviceName}. Cliente: ${context.customerName}. Fecha: ${formatAppointmentDate(context.startsAt)}. Total: ${formatCurrency(context.totalAmount)}.`;
}

function buildBusinessBookingCancelledText(context: AppointmentEmailContext, wasRefunded: boolean) {
  const refundText = wasRefunded ? " Se solicito el reembolso en Mercado Pago." : "";

  return `Turno cancelado para ${context.serviceName}. Cliente: ${context.customerName}. Fecha: ${formatAppointmentDate(context.startsAt)}.${refundText}`;
}

function buildTransferReceiptText(context: AppointmentEmailContext) {
  if (context.paymentMethod !== "transfer" || !context.receiptWhatsapp.trim()) {
    return "";
  }

  return ` Envia el comprobante por WhatsApp a ${context.receiptWhatsapp}.`;
}

function buildCancellationText(context: AppointmentEmailContext) {
  return `Si necesitas cancelar, podes hacerlo hasta ${formatLeadTime(context.cancellationLeadMinutes)} antes desde ${buildCancellationUrl(context.publicCancelToken)}.`;
}

function buildCancellationUrl(token: string) {
  return `${getPublicSiteUrl()}/cancelar-turno/${encodeURIComponent(token)}`;
}

function getPublicSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (siteUrl) {
    return siteUrl.replace(/\/+$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }

  return "http://localhost:3000";
}

function formatLeadTime(minutes: number) {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;

    return `${days} ${days === 1 ? "dia" : "dias"}`;
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60;

    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }

  return `${minutes} minutos`;
}
