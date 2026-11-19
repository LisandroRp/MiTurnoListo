const activeSubscriptionStatus = "authorized";
const externalReferencePrefix = "mtl";

export function buildSubscriptionExternalReference(businessKey: string, userId: string, intentId: string, plan?: "pro" | "unlimited") {
  return `${externalReferencePrefix}|b:${businessKey}|u:${userId}|i:${intentId}${plan ? `|p:${plan}` : ""}`;
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

export function mapMercadoPagoStatusToTier(status?: string, plan: "pro" | "unlimited" = "pro") {
  return status === activeSubscriptionStatus ? plan : "free";
}

export function isInvalidCallerPreapprovalError(message: string) {
  const normalizedMessage = message.toLowerCase();

  return normalizedMessage.includes("preapprovalid") && normalizedMessage.includes("callerid");
}


export function getSubscriptionPlanFromReference(reference?: string | null): "pro" | "unlimited" {
  const plan = reference?.split("|").find((segment) => segment.startsWith("p:"))?.slice(2);
  if (plan === undefined) return "pro";
  if (plan !== "pro" && plan !== "unlimited") throw new Error("Unknown subscription plan reference.");
  return plan;
}
