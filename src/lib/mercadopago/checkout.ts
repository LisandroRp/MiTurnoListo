import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { sendBookingConfirmedEmails } from "@/lib/email/booking-emails";

type CreateMercadoPagoPreferenceInput = {
  accessToken: string;
  amount: number;
  appointmentId: string;
  customer: {
    email: string;
    fullName: string;
    phone: string;
  };
  origin: string;
  serviceName: string;
};

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPaymentResponse = {
  external_reference?: string;
  message?: string;
  status?: string;
};

type MercadoPagoRefundResponse = {
  id?: string | number;
  message?: string;
  status?: string;
};

export function getMercadoPagoPublicOrigin(requestOrigin: string) {
  const publicUrl = process.env.APP_PUBLIC_URL?.trim().replace(/\/+$/, "");
  const origin = publicUrl || requestOrigin;

  if (!origin.startsWith("https://")) {
    throw new Error("Mercado Pago necesita una URL publica HTTPS para redirigir. Configura APP_PUBLIC_URL con tu tunel o dominio de produccion.");
  }

  return origin;
}

export async function createMercadoPagoPreference({
  accessToken,
  amount,
  appointmentId,
  customer,
  origin,
  serviceName
}: CreateMercadoPagoPreferenceInput) {
  const resultUrl = `${origin}/reservar/resultado?appointmentId=${encodeURIComponent(appointmentId)}`;
  const notificationUrl = buildMercadoPagoPaymentNotificationUrl(origin, appointmentId);
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      auto_return: "approved",
      back_urls: {
        success: resultUrl,
        pending: resultUrl,
        failure: resultUrl
      },
      external_reference: appointmentId,
      items: [
        {
          id: appointmentId,
          title: `Reserva - ${serviceName}`,
          quantity: 1,
          currency_id: "ARS",
          unit_price: amount
        }
      ],
      payer: {
        email: customer.email,
        name: customer.fullName,
        phone: {
          number: customer.phone
        }
      },
      notification_url: notificationUrl
    })
  });

  const preference = await response.json() as MercadoPagoPreferenceResponse & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(preference.message ?? "Unable to create Mercado Pago checkout.");
  }

  const checkoutUrl = preference.init_point ?? preference.sandbox_init_point;

  if (!checkoutUrl) {
    throw new Error("Mercado Pago did not return a checkout URL.");
  }

  return {
    checkoutUrl,
    preferenceId: preference.id ?? ""
  };
}

function buildMercadoPagoPaymentNotificationUrl(origin: string, appointmentId: string) {
  const notificationUrl = new URL("/api/mercadopago/webhook", origin);
  const webhookToken = process.env.MP_WEBHOOK_TOKEN?.trim();

  notificationUrl.searchParams.set("appointmentId", appointmentId);

  if (webhookToken) {
    notificationUrl.searchParams.set("token", webhookToken);
  }

  return notificationUrl.toString();
}

export async function confirmMercadoPagoAppointmentPayment({
  appointmentId,
  paymentId
}: {
  appointmentId: string;
  paymentId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, business_id, mercadopago_payment_id, status")
    .eq("id", appointmentId)
    .limit(1)
    .maybeSingle();

  if (appointmentError || !appointment) {
    return {
      status: "not_found" as const,
      isConfirmed: false
    };
  }

  const { data: paymentSettings, error: paymentSettingsError } = await supabase
    .from("business_payment_settings")
    .select("mercadopago_access_token")
    .eq("business_id", appointment.business_id)
    .limit(1)
    .maybeSingle();

  const accessToken = paymentSettings?.mercadopago_access_token?.trim();

  if (paymentSettingsError || !accessToken) {
    return {
      status: "configuration_error" as const,
      isConfirmed: false
    };
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  const payment = await response.json() as MercadoPagoPaymentResponse;

  if (!response.ok) {
    return {
      status: "verification_error" as const,
      isConfirmed: false
    };
  }

  if (payment.external_reference !== appointmentId) {
    return {
      status: "reference_mismatch" as const,
      isConfirmed: false
    };
  }

  if (payment.status !== "approved") {
    return {
      status: payment.status ?? "pending",
      isConfirmed: false
    };
  }

  let shouldSendConfirmationEmails = false;

  if (appointment.status !== "confirmed") {
    const { data: confirmedAppointment, error: updateError } = await supabase
      .from("appointments")
      .update({
        mercadopago_payment_id: paymentId,
        status: "confirmed"
      })
      .eq("id", appointmentId)
      .neq("status", "confirmed")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return {
        status: "update_error" as const,
        isConfirmed: false
      };
    }

    shouldSendConfirmationEmails = Boolean(confirmedAppointment);
  } else if (!appointment.mercadopago_payment_id) {
    await supabase
      .from("appointments")
      .update({ mercadopago_payment_id: paymentId })
      .eq("id", appointmentId);
  }

  if (shouldSendConfirmationEmails) {
    await sendBookingConfirmedEmails({ appointmentId });
  }

  return {
    status: "approved" as const,
    isConfirmed: true
  };
}

export async function refundMercadoPagoPayment({
  businessId,
  paymentId
}: {
  businessId: string;
  paymentId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data: paymentSettings, error: paymentSettingsError } = await supabase
    .from("business_payment_settings")
    .select("mercadopago_access_token")
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();
  const accessToken = paymentSettings?.mercadopago_access_token?.trim();

  if (paymentSettingsError || !accessToken) {
    throw new Error("Mercado Pago is not configured for this business.");
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as MercadoPagoRefundResponse | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Mercado Pago could not refund the payment.");
  }

  return {
    refundId: payload?.id ? String(payload.id) : "",
    status: payload?.status ?? "approved"
  };
}
