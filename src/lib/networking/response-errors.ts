export async function getResponseErrorMessage(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");

    return text.trim() || fallbackMessage;
  }

  const payload = await response.json().catch(() => null);

  return getPayloadErrorMessage(payload, fallbackMessage);
}

export function getPayloadErrorMessage(payload: unknown, fallbackMessage: string) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallbackMessage;
  }

  const record = payload as Record<string, unknown>;
  const directMessage = getStringValue(record, ["error", "message", "reason", "description", "error_description"]);

  if (directMessage) {
    return directMessage;
  }

  const nestedError = record.error;

  if (nestedError && nestedError !== payload) {
    return getPayloadErrorMessage(nestedError, fallbackMessage);
  }

  return fallbackMessage;
}

function getStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}
