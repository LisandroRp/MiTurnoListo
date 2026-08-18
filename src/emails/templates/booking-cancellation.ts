// Used in production for customer-facing appointment cancellation emails.
import { detailCard, emailShell, escapeHtml } from "@/emails/templates/shared";

type BookingCancellationEmailProps = {
  appointmentDateTime: string;
  businessName: string;
  cancellationReason: string;
  customerName: string;
  employeeName?: string | null;
  serviceName: string;
  totalAmount: string;
  wasRefunded: boolean;
};

export function bookingCancellationEmail({
  appointmentDateTime,
  businessName,
  cancellationReason,
  customerName,
  employeeName,
  serviceName,
  totalAmount,
  wasRefunded
}: BookingCancellationEmailProps): string {
  const normalizedReason = cancellationReason.trim();

  return emailShell({
    body: `
      <tr>
        <td style="padding:32px 32px 16px 32px;">
          <p style="margin:0 0 16px 0; font-size:16px; line-height:26px; color:#17202b;">Hola, ${escapeHtml(customerName)}.</p>
          <p style="margin:0 0 24px 0; font-size:16px; line-height:26px; color:#545f6c;">
            Tu turno en <strong style="color:#17202b;">${escapeHtml(businessName)}</strong> fue cancelado.
          </p>
          ${detailCard([
            { label: "Servicio", value: serviceName },
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
        </td>
      </tr>
      ${wasRefunded ? `
        <tr>
          <td style="padding:0 32px 24px 32px;">
            <p style="margin:0; font-size:15px; line-height:24px; color:#545f6c;">Si habías pagado con Mercado Pago, el reembolso fue solicitado correctamente.</p>
          </td>
        </tr>
      ` : ""}
    `,
    eyebrow: "Turno cancelado",
    heading: "Tu turno fue cancelado",
    preheader: `Tu turno en ${businessName} fue cancelado.`,
    title: "Turno cancelado"
  });
}
