type BookingConfirmationEmailProps = {
  appointmentDate: string;
  appointmentTime: string;
  businessName: string;
  customerName: string;
  employeeName?: string | null;
  manageBookingUrl: string;
  serviceName: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function bookingConfirmationEmail({
  appointmentDate,
  appointmentTime,
  businessName,
  customerName,
  employeeName,
  manageBookingUrl,
  serviceName
}: BookingConfirmationEmailProps): string {
  const safeBusinessName = escapeHtml(businessName);
  const safeCustomerName = escapeHtml(customerName);
  const safeEmployeeName = employeeName ? escapeHtml(employeeName) : null;
  const safeServiceName = escapeHtml(serviceName);

  return `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tu turno está confirmado</title>
  </head>
  <body style="margin:0; padding:0; background-color:#fff6f3; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif; color:#17202b;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
      Tu turno en ${safeBusinessName} quedó confirmado.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fff6f3; margin:0; padding:0;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background-color:#ffffff; border:1px solid #f1dfd7; border-radius:20px; overflow:hidden; box-shadow:0 12px 36px rgba(23,32,43,0.10);">
            <tr>
              <td style="height:6px; background-color:#ed886e; font-size:0; line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td align="center" style="padding:32px 32px 24px 32px; background-color:#faebe5;">
                <img src="https://www.miturnolisto.com/branding/logo-wide.png" alt="MiTurnoListo" width="220" border="0" style="display:block; max-width:220px; width:100%; height:auto; margin:0 auto 20px auto; border:0; outline:none; text-decoration:none;" />
                <p style="margin:0 0 12px 0; font-size:12px; line-height:18px; letter-spacing:0.08em; text-transform:uppercase; color:#9d381e; font-weight:700;">Reserva confirmada</p>
                <h1 style="margin:0; font-size:30px; line-height:38px; color:#17202b; font-weight:800;">Tu turno está confirmado</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 16px 32px;">
                <p style="margin:0 0 16px 0; font-size:16px; line-height:26px; color:#17202b;">Hola, ${safeCustomerName}.</p>
                <p style="margin:0 0 24px 0; font-size:16px; line-height:26px; color:#545f6c;">
                  Tu reserva en <strong style="color:#17202b;">${safeBusinessName}</strong> quedó confirmada.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fff8f5; border:1px solid #f1dfd7; border-radius:14px;">
                  <tr>
                    <td style="padding:20px 20px 8px 20px; font-size:14px; line-height:20px; color:#7b8794;">SERVICIO</td>
                  </tr>
                  <tr>
                    <td style="padding:0 20px 16px 20px; font-size:17px; line-height:24px; color:#17202b; font-weight:700;">${safeServiceName}</td>
                  </tr>
                  ${
                    safeEmployeeName
                      ? `
                  <tr>
                    <td style="padding:0 20px 8px 20px; font-size:14px; line-height:20px; color:#7b8794;">PROFESIONAL</td>
                  </tr>
                  <tr>
                    <td style="padding:0 20px 16px 20px; font-size:16px; line-height:24px; color:#17202b;">${safeEmployeeName}</td>
                  </tr>
                  `
                      : ""
                  }
                  <tr>
                    <td style="padding:0 20px 8px 20px; font-size:14px; line-height:20px; color:#7b8794;">FECHA Y HORA</td>
                  </tr>
                  <tr>
                    <td style="padding:0 20px 20px 20px; font-size:16px; line-height:24px; color:#17202b;">${escapeHtml(appointmentDate)} a las ${escapeHtml(appointmentTime)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 32px 32px 32px;">
                <a href="${escapeHtml(manageBookingUrl)}" style="display:inline-block; background-color:#ed886e; color:#190e0c; text-decoration:none; font-size:16px; font-weight:800; padding:14px 28px; border-radius:12px;">Ver mi reserva</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <p style="margin:0; font-size:15px; line-height:24px; color:#545f6c;">Si necesitás cancelar o reprogramar el turno, podés hacerlo desde el enlace anterior.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px 32px; border-top:1px solid #f1dfd7; background-color:#fffdfa;">
                <p style="margin:0 0 8px 0; font-size:13px; line-height:20px; color:#545f6c; text-align:center;">
                  Esta reserva fue gestionada mediante
                  <a href="https://www.miturnolisto.com" style="color:#9d381e; text-decoration:none; font-weight:700;">MiTurnoListo</a>
                </p>
                <p style="margin:0; font-size:12px; line-height:18px; color:#7b8794; text-align:center;">https://www.miturnolisto.com</p>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
            <tr>
              <td style="padding:16px 12px 0 12px; text-align:center;">
                <p style="margin:0; font-size:12px; line-height:18px; color:#7b8794;">© MiTurnoListo. Todos los derechos reservados.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
