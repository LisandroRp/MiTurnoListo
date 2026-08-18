// Used in production for customer-facing booking emails: reservation received and confirmed appointments.
import { detailCard, emailShell, escapeHtml, primaryButton } from "@/emails/templates/shared";

type BookingConfirmationEmailProps = {
  appointmentDate: string;
  appointmentTime: string;
  businessName: string;
  customerName: string;
  employeeName?: string | null;
  manageBookingUrl: string;
  serviceName: string;
};

export function bookingConfirmationEmail({
  appointmentDate,
  appointmentTime,
  businessName,
  customerName,
  employeeName,
  manageBookingUrl,
  serviceName
}: BookingConfirmationEmailProps): string {
  return emailShell({
    body: `
      <tr>
        <td style="padding:32px 32px 16px 32px;">
          <p style="margin:0 0 16px 0; font-size:16px; line-height:26px; color:#17202b;">Hola, ${escapeHtml(customerName)}.</p>
          <p style="margin:0 0 24px 0; font-size:16px; line-height:26px; color:#545f6c;">
            Tu reserva en <strong style="color:#17202b;">${escapeHtml(businessName)}</strong> quedó confirmada.
          </p>
          ${detailCard([
            { label: "Servicio", value: serviceName },
            { label: "Profesional", value: employeeName },
            { label: "Fecha y hora", value: `${appointmentDate} a las ${appointmentTime}` }
          ])}
        </td>
      </tr>
      ${primaryButton({ href: manageBookingUrl, label: "Ver mi reserva" })}
      <tr>
        <td style="padding:0 32px 24px 32px;">
          <p style="margin:0; font-size:15px; line-height:24px; color:#545f6c;">Si necesitás cancelar o reprogramar el turno, podés hacerlo desde el enlace anterior.</p>
        </td>
      </tr>
    `,
    eyebrow: "Reserva confirmada",
    heading: "Tu turno está confirmado",
    preheader: `Tu turno en ${businessName} quedó confirmado.`,
    title: "Tu turno está confirmado"
  });
}
