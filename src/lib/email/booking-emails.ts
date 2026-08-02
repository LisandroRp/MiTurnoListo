import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { formatCurrency } from "@/features/scheduling/utils/format";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { sendEmail } from "@/lib/email/resend";

type BookingEmailInput = {
  appointmentId: string;
};

type BookingCancellationEmailInput = BookingEmailInput & {
  wasRefunded: boolean;
};

type AppointmentEmailContext = {
  appointmentId: string;
  businessId: string;
  businessName: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
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
      html: buildBookingCreatedCustomerHtml(context),
      subject: `Reserva recibida en ${context.businessName}`,
      text: buildBookingCreatedCustomerText(context),
      to: context.customerEmail
    }),
    sendBusinessBookingNotificationEmail(context)
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
      html: buildBookingConfirmedHtml(context),
      subject: `Turno confirmado en ${context.businessName}`,
      text: buildBookingConfirmedText(context),
      to: context.customerEmail
    }),
    sendBusinessPaymentConfirmedEmail(context)
  ]);
  logSkippedEmailResults(results);
}

export async function sendBookingCancelledEmails(input: BookingCancellationEmailInput) {
  const context = await getAppointmentEmailContext(input.appointmentId);

  if (!context) {
    return;
  }

  const results = await Promise.all([
    sendEmail({
      html: buildBookingCancelledCustomerHtml(context, input.wasRefunded),
      subject: `Turno cancelado en ${context.businessName}`,
      text: buildBookingCancelledCustomerText(context, input.wasRefunded),
      to: context.customerEmail
    }),
    sendBusinessBookingCancelledEmail(context, input.wasRefunded)
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
    html: buildPlanLimitHtml(context.businessName),
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
    html: buildBusinessNotificationHtml(context),
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
    html: buildBusinessPaymentConfirmedHtml(context),
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
    html: buildBusinessBookingCancelledHtml(context, wasRefunded),
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
    .select("id, business_id, employee_id, service_id, starts_at, total_amount, selected_payment_method, public_cancel_token, customer_name_snapshot, customer_email_snapshot, customer_phone_snapshot")
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

function buildBookingCreatedCustomerText(context: AppointmentEmailContext) {
  return `Hola ${context.customerName}, recibimos tu reserva para ${context.serviceName} en ${context.businessName}. Fecha: ${formatAppointmentDate(context.startsAt)}. Profesional: ${context.employeeName}.${buildTransferReceiptText(context)} ${buildCancellationText(context)}`;
}

function buildBookingCreatedCustomerHtml(context: AppointmentEmailContext) {
  return buildEmailShell({
    body: `
      <p>Hola ${escapeHtml(context.customerName)},</p>
      <p>Recibimos tu reserva para <strong>${escapeHtml(context.serviceName)}</strong> en ${escapeHtml(context.businessName)}.</p>
      ${buildAppointmentDetails(context)}
      ${buildTransferReceiptHtml(context)}
      ${buildCancellationHtml(context)}
      <p>El negocio va a confirmar el turno o el pago segun corresponda.</p>
    `,
    title: "Reserva recibida"
  });
}

function buildBookingConfirmedText(context: AppointmentEmailContext) {
  return `Hola ${context.customerName}, tu turno en ${context.businessName} quedo confirmado. Servicio: ${context.serviceName}. Fecha: ${formatAppointmentDate(context.startsAt)}. ${buildCancellationText(context)}`;
}

function buildBookingConfirmedHtml(context: AppointmentEmailContext) {
  return buildEmailShell({
    body: `
      <p>Hola ${escapeHtml(context.customerName)},</p>
      <p>Tu turno en ${escapeHtml(context.businessName)} quedo <strong>confirmado</strong>.</p>
      ${buildAppointmentDetails(context)}
      ${buildCancellationHtml(context)}
    `,
    title: "Turno confirmado"
  });
}

function buildBookingCancelledCustomerText(context: AppointmentEmailContext, wasRefunded: boolean) {
  const refundText = wasRefunded
    ? " Si habias pagado con Mercado Pago, el reembolso fue solicitado correctamente."
    : "";

  return `Hola ${context.customerName}, tu turno en ${context.businessName} fue cancelado. Servicio: ${context.serviceName}. Fecha: ${formatAppointmentDate(context.startsAt)}.${refundText}`;
}

function buildBookingCancelledCustomerHtml(context: AppointmentEmailContext, wasRefunded: boolean) {
  return buildEmailShell({
    body: `
      <p>Hola ${escapeHtml(context.customerName)},</p>
      <p>Tu turno en ${escapeHtml(context.businessName)} fue <strong>cancelado</strong>.</p>
      ${buildAppointmentDetails(context)}
      ${wasRefunded ? "<p>Si habias pagado con Mercado Pago, el reembolso fue solicitado correctamente.</p>" : ""}
    `,
    title: "Turno cancelado"
  });
}


function buildBusinessNotificationText(context: AppointmentEmailContext) {
  return `Nueva reserva para ${context.serviceName}. Cliente: ${context.customerName}. Fecha: ${formatAppointmentDate(context.startsAt)}. Telefono: ${context.customerPhone}.${buildTransferReceiptText(context)}`;
}

function buildBusinessNotificationHtml(context: AppointmentEmailContext) {
  return buildEmailShell({
    body: `
      <p>Tenes una nueva reserva para <strong>${escapeHtml(context.serviceName)}</strong>.</p>
      ${buildAppointmentDetails(context)}
      <p><strong>Cliente:</strong> ${escapeHtml(context.customerName)}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(context.customerPhone || "-")}</p>
      <p><strong>Email:</strong> ${escapeHtml(context.customerEmail)}</p>
      ${buildTransferReceiptHtml(context)}
    `,
    title: "Nueva reserva"
  });
}

function buildBusinessPaymentConfirmedText(context: AppointmentEmailContext) {
  return `Pago confirmado por Mercado Pago para ${context.serviceName}. Cliente: ${context.customerName}. Fecha: ${formatAppointmentDate(context.startsAt)}. Total: ${formatCurrency(context.totalAmount)}.`;
}

function buildBusinessPaymentConfirmedHtml(context: AppointmentEmailContext) {
  return buildEmailShell({
    body: `
      <p>Mercado Pago confirmo el cobro de una reserva.</p>
      ${buildAppointmentDetails(context)}
      <p><strong>Cliente:</strong> ${escapeHtml(context.customerName)}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(context.customerPhone || "-")}</p>
      <p><strong>Email:</strong> ${escapeHtml(context.customerEmail)}</p>
    `,
    title: "Pago confirmado"
  });
}

function buildBusinessBookingCancelledText(context: AppointmentEmailContext, wasRefunded: boolean) {
  const refundText = wasRefunded ? " Se solicito el reembolso en Mercado Pago." : "";

  return `Turno cancelado para ${context.serviceName}. Cliente: ${context.customerName}. Fecha: ${formatAppointmentDate(context.startsAt)}.${refundText}`;
}

function buildBusinessBookingCancelledHtml(context: AppointmentEmailContext, wasRefunded: boolean) {
  return buildEmailShell({
    body: `
      <p>Se cancelo una reserva para <strong>${escapeHtml(context.serviceName)}</strong>.</p>
      ${buildAppointmentDetails(context)}
      <p><strong>Cliente:</strong> ${escapeHtml(context.customerName)}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(context.customerPhone || "-")}</p>
      <p><strong>Email:</strong> ${escapeHtml(context.customerEmail)}</p>
      ${wasRefunded ? "<p>Se solicito el reembolso en Mercado Pago.</p>" : ""}
    `,
    title: "Turno cancelado"
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

function buildTransferReceiptText(context: AppointmentEmailContext) {
  if (context.paymentMethod !== "transfer" || !context.receiptWhatsapp.trim()) {
    return "";
  }

  return ` Envia el comprobante por WhatsApp a ${context.receiptWhatsapp}.`;
}

function buildTransferReceiptHtml(context: AppointmentEmailContext) {
  if (context.paymentMethod !== "transfer" || !context.receiptWhatsapp.trim()) {
    return "";
  }

  return `<p><strong>Comprobante:</strong> Envia el comprobante por WhatsApp a ${escapeHtml(context.receiptWhatsapp)}.</p>`;
}

function buildCancellationText(context: AppointmentEmailContext) {
  return `Si necesitas cancelar, podes hacerlo hasta ${formatLeadTime(context.cancellationLeadMinutes)} antes desde ${buildCancellationUrl(context.publicCancelToken)}.`;
}

function buildCancellationHtml(context: AppointmentEmailContext) {
  const cancellationUrl = buildCancellationUrl(context.publicCancelToken);

  return `
    <p>
      Si necesitas cancelar, podes hacerlo hasta ${escapeHtml(formatLeadTime(context.cancellationLeadMinutes))} antes:
      <a href="${escapeHtml(cancellationUrl)}">cancelar turno</a>.
    </p>
  `;
}

function buildCancellationUrl(token: string) {
  return `${getPublicSiteUrl()}/cancelar-turno/${encodeURIComponent(token)}`;
}

function getPublicSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.APP_PUBLIC_URL?.trim();

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
