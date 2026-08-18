// Prepared for business-owner Mercado Pago confirmation notifications; not sent by any current production flow yet.
import { detailCard, emailShell, escapeHtml } from "@/emails/templates/shared";

type BusinessPaymentConfirmedEmailProps = {
  appointmentDateTime: string;
  businessName: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  employeeName?: string | null;
  serviceName: string;
  totalAmount: string;
};

export function businessPaymentConfirmedEmail({
  appointmentDateTime,
  businessName,
  customerEmail,
  customerName,
  customerPhone,
  employeeName,
  serviceName,
  totalAmount
}: BusinessPaymentConfirmedEmailProps): string {
  return emailShell({
    body: `
      <tr>
        <td style="padding:32px 32px 24px 32px;">
          <p style="margin:0 0 24px 0; font-size:16px; line-height:26px; color:#545f6c;">
            Mercado Pago confirmó el cobro de una reserva para <strong style="color:#17202b;">${escapeHtml(serviceName)}</strong>.
          </p>
          ${detailCard([
            { label: "Cliente", value: customerName },
            { label: "Teléfono", value: customerPhone || "-" },
            { label: "Email", value: customerEmail },
            { label: "Profesional", value: employeeName },
            { label: "Fecha y hora", value: appointmentDateTime },
            { label: "Total", value: totalAmount }
          ])}
        </td>
      </tr>
    `,
    eyebrow: "Pago confirmado",
    heading: "Pago confirmado",
    preheader: `Pago confirmado para ${serviceName} en ${businessName}.`,
    title: "Pago confirmado"
  });
}
