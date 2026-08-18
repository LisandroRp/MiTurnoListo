import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { bookingCancellationEmail } from "@/emails/templates/booking-cancellation";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";
import { businessBookingCancellationEmail } from "@/emails/templates/business-booking-cancellation";
import { businessBookingNotificationEmail } from "@/emails/templates/business-booking-notification";
import { businessPaymentConfirmedEmail } from "@/emails/templates/business-payment-confirmed";
import { planLimitReachedEmail } from "@/emails/templates/plan-limit-reached";

export const metadata: Metadata = {
  title: "Email templates",
  robots: {
    index: false,
    follow: false
  }
};

type EmailTemplatePreview = {
  description: string;
  html: string;
  id: string;
  name: string;
};

type PageProps = {
  searchParams?: Promise<{
    template?: string;
  }>;
};

const sampleAppointment = {
  appointmentDate: "jueves, 20 de agosto de 2026",
  appointmentDateTime: "jueves, 20 de agosto de 2026, 17:30",
  appointmentTime: "17:30",
  businessName: "Turnos Studio",
  cancellationReason: "El profesional tuvo un imprevisto y no va a poder atender en ese horario.",
  customerEmail: "cliente@email.com",
  customerName: "Mateo Ruiz",
  customerPhone: "+54 9 11 5555-5555",
  employeeName: "Camila Torres",
  manageBookingUrl: "https://www.miturnolisto.com/cancelar-turno/demo-token",
  receiptWhatsapp: "+54 9 11 4444-4444",
  serviceName: "Corte y styling",
  totalAmount: "$ 18.500"
};

const templates: EmailTemplatePreview[] = [
  {
    description: "Cliente. Se usa cuando una reserva fue recibida o confirmada.",
    html: bookingConfirmationEmail(sampleAppointment),
    id: "booking-confirmation",
    name: "Reserva confirmada"
  },
  {
    description: "Cliente. Se usa cuando se cancela un turno.",
    html: bookingCancellationEmail({
      ...sampleAppointment,
      wasRefunded: true
    }),
    id: "booking-cancellation",
    name: "Turno cancelado"
  },
  {
    description: "Negocio. Preparado para avisar una nueva reserva.",
    html: businessBookingNotificationEmail(sampleAppointment),
    id: "business-booking-notification",
    name: "Nueva reserva para negocio"
  },
  {
    description: "Negocio. Preparado para avisar una cancelacion.",
    html: businessBookingCancellationEmail({
      ...sampleAppointment,
      wasRefunded: true
    }),
    id: "business-booking-cancellation",
    name: "Cancelacion para negocio"
  },
  {
    description: "Negocio. Preparado para avisar pago confirmado por Mercado Pago.",
    html: businessPaymentConfirmedEmail(sampleAppointment),
    id: "business-payment-confirmed",
    name: "Pago confirmado"
  },
  {
    description: "Negocio. Se usa cuando llega al limite mensual del plan Free.",
    html: planLimitReachedEmail({ businessName: sampleAppointment.businessName }),
    id: "plan-limit-reached",
    name: "Limite plan Free"
  }
];

export default async function AdminEmailsPage({ searchParams }: PageProps) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";

  if (!isLocalhost(host)) {
    notFound();
  }

  const params = await searchParams;
  const selectedTemplateId = params?.template ?? templates[0].id;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];

  return (
    <main>
      <h1>Email templates</h1>
      <ul>
        {templates.map((template) => (
          <li key={template.id}>
            <a href={`/admin/emails?template=${encodeURIComponent(template.id)}`}>
              {template.name}
            </a>
            {" - "}
            <span>{template.description}</span>
          </li>
        ))}
      </ul>

      <h2>{selectedTemplate.name}</h2>
      <p>{selectedTemplate.description}</p>
      <iframe
        title={selectedTemplate.name}
        srcDoc={selectedTemplate.html}
        style={{ width: "100%", height: "900px", border: "1px solid #ccc" }}
      />
    </main>
  );
}

function isLocalhost(host: string) {
  if (host.toLowerCase().startsWith("[::1]")) {
    return true;
  }

  const hostname = host.split(":")[0]?.toLowerCase();

  return hostname === "localhost" || hostname === "127.0.0.1";
}
