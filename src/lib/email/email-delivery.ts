type EmailDeliveryEnv = Record<string, string | undefined>;

const enabledValues = new Set(["1", "on", "true", "yes"]);

export function isNonCriticalEmailDeliveryDisabled(env: EmailDeliveryEnv = process.env) {
  return enabledValues.has(env.DONT_SEND_EMAILS?.trim().toLowerCase() ?? "");
}
