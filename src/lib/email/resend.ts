import "server-only";

import { getResponseErrorPayload } from "@/lib/networking/api-errors";

type SendEmailInput = {
  html: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  to: string;
};

type SendEmailResult =
  | { status: "sent" }
  | { reason: string; status: "skipped" };

export async function sendEmail({
  html,
  replyTo,
  subject,
  text,
  to
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return {
      reason: "Email provider is not configured.",
      status: "skipped"
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
      ...(replyTo?.trim() ? { reply_to: replyTo.trim() } : {})
    })
  });

  if (!response.ok) {
    const errorPayload = await getResponseErrorPayload(response, "Resend rejected the email request.");

    return {
      reason: errorPayload.details
        ? `${errorPayload.message} (${errorPayload.details})`
        : errorPayload.message,
      status: "skipped"
    };
  }

  return { status: "sent" };
}
