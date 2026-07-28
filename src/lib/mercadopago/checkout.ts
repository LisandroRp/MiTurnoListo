import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { sendBookingConfirmedEmail } from "@/lib/email/booking-emails";

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
      ...(origin.startsWith("https://")
        ? { notification_url: `${origin}/api/mercadopago/webhook?appointmentId=${encodeURIComponent(appointmentId)}` }
        : {})
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
    .select("id, business_id, status")
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

  if (appointment.status !== "confirmed") {
    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", appointmentId);

    if (updateError) {
      return {
        status: "update_error" as const,
        isConfirmed: false
      };
    }
  }

  await sendBookingConfirmedEmail({ appointmentId });

  return {
    status: "approved" as const,
    isConfirmed: true
  };
}
