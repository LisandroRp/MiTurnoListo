// Prepared for business-owner booking notifications; not sent by any current production flow yet.
import { detailCard, emailShell, escapeHtml } from "@/emails/templates/shared";

type BusinessBookingNotificationEmailProps = {
  appointmentDateTime: string;
  businessName: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  employeeName?: string | null;
  receiptWhatsapp?: string | null;
  serviceName: string;
  totalAmount: string;
};

export function businessBookingNotificationEmail({
  appointmentDateTime,
  businessName,
  customerEmail,
  customerName,
  customerPhone,
  employeeName,
  receiptWhatsapp,
  serviceName,
  totalAmount
}: BusinessBookingNotificationEmailProps): string {
  return emailShell({
    body: `
      <tr>
        <td style="padding:32px 32px 24px 32px;">
          <p style="margin:0 0 24px 0; font-size:16px; line-height:26px; color:#545f6c;">
            Tenés una nueva reserva para <strong style="color:#17202b;">${escapeHtml(serviceName)}</strong>.
          </p>
          ${detailCard([
            { label: "Cliente", value: customerName },
            { label: "Teléfono", value: customerPhone || "-" },
            { label: "Email", value: customerEmail },
            { label: "Profesional", value: employeeName },
            { label: "Fecha y hora", value: appointmentDateTime },
            { label: "Total", value: totalAmount }
          ])}
          ${receiptWhatsapp?.trim() ? `
            <p style="margin:18px 0 0 0; font-size:15px; line-height:24px; color:#545f6c;">El cliente debe enviar el comprobante por WhatsApp a <strong style="color:#17202b;">${escapeHtml(receiptWhatsapp.trim())}</strong>.</p>
          ` : ""}
        </td>
      </tr>
    `,
    eyebrow: "Nueva reserva",
    heading: "Tenés una nueva reserva",
    preheader: `Nueva reserva para ${serviceName} en ${businessName}.`,
    title: "Nueva reserva"
  });
}
