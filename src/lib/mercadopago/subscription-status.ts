const activeSubscriptionStatus = "authorized";
const externalReferencePrefix = "mtl";

export function buildSubscriptionExternalReference(businessKey: string, userId: string, intentId: string) {
  return `${externalReferencePrefix}|b:${businessKey}|u:${userId}|i:${intentId}`;
}

export function extractBusinessIdFromExternalReference(externalReference?: string | null) {
  if (!externalReference) {
    return null;
  }

  if (externalReference.startsWith(`${externalReferencePrefix}|`)) {
    const businessSegment = externalReference
      .split("|")
      .find((segment) => segment.startsWith("b:"));

    return businessSegment?.replace(/^b:/, "").trim() || null;
  }

  if (externalReference.startsWith(`${externalReferencePrefix}_b_`)) {
    const businessId = externalReference.match(/^mtl_b_([^_]+)_u_/)?.[1];

    return businessId?.trim() || null;
  }

  const [businessId] = externalReference.split(":");
  return businessId?.trim() || null;
}

export function mapMercadoPagoStatusToTier(status?: string) {
  return status === activeSubscriptionStatus ? "pro" : "free";
}

export function isInvalidCallerPreapprovalError(message: string) {
  const normalizedMessage = message.toLowerCase();

  return normalizedMessage.includes("preapprovalid") && normalizedMessage.includes("callerid");
}
