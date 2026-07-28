const activeSubscriptionStatus = "authorized";
const externalReferencePrefix = "mtl";

export function buildSubscriptionExternalReference(businessId: string, userId: string, intentId: string) {
  return `${externalReferencePrefix}_b_${businessId}_u_${userId}_i_${intentId}`;
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
