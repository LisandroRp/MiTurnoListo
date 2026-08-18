// Used in production when a business reaches the monthly appointment limit for the Free plan.
import { emailShell, escapeHtml } from "@/emails/templates/shared";

type PlanLimitReachedEmailProps = {
  businessName: string;
};

export function planLimitReachedEmail({ businessName }: PlanLimitReachedEmailProps): string {
  return emailShell({
    body: `
      <tr>
        <td style="padding:32px 32px 24px 32px;">
          <p style="margin:0 0 16px 0; font-size:16px; line-height:26px; color:#17202b;">Hola.</p>
          <p style="margin:0 0 16px 0; font-size:16px; line-height:26px; color:#545f6c;">
            <strong style="color:#17202b;">${escapeHtml(businessName)}</strong> llegó al límite mensual de turnos del plan Free.
          </p>
          <p style="margin:0; font-size:16px; line-height:26px; color:#545f6c;">
            Activá Premium para seguir recibiendo reservas online este mes.
          </p>
        </td>
      </tr>
    `,
    eyebrow: "Plan Free",
    heading: "Límite mensual alcanzado",
    preheader: `${businessName} llegó al límite mensual del plan Free.`,
    title: "Límite Free alcanzado"
  });
}
