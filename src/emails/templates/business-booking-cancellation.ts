// Prepared for business-owner appointment cancellation notifications; not sent by any current production flow yet.
import { detailCard, emailShell, escapeHtml } from "@/emails/templates/shared";

type BusinessBookingCancellationEmailProps = {
  appointmentDateTime: string;
  businessName: string;
  cancellationReason: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  employeeName?: string | null;
  serviceName: string;
  totalAmount: string;
  wasRefunded: boolean;
};

export function businessBookingCancellationEmail({
  appointmentDateTime,
  businessName,
  cancellationReason,
  customerEmail,
  customerName,
  customerPhone,
  employeeName,
  serviceName,
  totalAmount,
  wasRefunded
}: BusinessBookingCancellationEmailProps): string {
  const normalizedReason = cancellationReason.trim();

  return emailShell({
    body: `
      <tr>
        <td style="padding:32px 32px 24px 32px;">
          <p style="margin:0 0 24px 0; font-size:16px; line-height:26px; color:#545f6c;">
            Se canceló una reserva para <strong style="color:#17202b;">${escapeHtml(serviceName)}</strong>.
          </p>
          ${detailCard([
            { label: "Cliente", value: customerName },
            { label: "Teléfono", value: customerPhone || "-" },
            { label: "Email", value: customerEmail },
            { label: "Profesional", value: employeeName },
            { label: "Fecha y hora", value: appointmentDateTime },
            { label: "Total", value: totalAmount }
          ])}
          ${normalizedReason ? `
            <div style="margin-top:16px; padding:16px 18px; border:1px solid #f1dfd7; border-radius:14px; background-color:#fffdfa;">
              <p style="margin:0 0 8px 0; font-size:12px; line-height:18px; letter-spacing:0.08em; text-transform:uppercase; color:#9d381e; font-weight:700;">Motivo de cancelación</p>
              <p style="margin:0; font-size:16px; line-height:25px; color:#17202b;">${escapeHtml(normalizedReason)}</p>
            </div>
          ` : ""}
          ${wasRefunded ? `
            <p style="margin:18px 0 0 0; font-size:15px; line-height:24px; color:#545f6c;">Se solicitó el reembolso en Mercado Pago.</p>
          ` : ""}
        </td>
      </tr>
    `,
    eyebrow: "Reserva cancelada",
    heading: "Se canceló una reserva",
    preheader: `Se canceló una reserva para ${serviceName} en ${businessName}.`,
    title: "Reserva cancelada"
  });
}
