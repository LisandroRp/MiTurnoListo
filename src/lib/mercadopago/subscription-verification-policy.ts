import { isInvalidCallerPreapprovalError } from "@/lib/mercadopago/subscription-status";

export type SubscriptionVerificationFailure = "not_found" | "permission" | "temporary";
export type SubscriptionVerificationNotice = {
  reason: SubscriptionVerificationFailure;
  retryAt: string | null;
  showNotice: boolean;
  needsReview?: boolean;
};

export class SubscriptionVerificationError extends Error {
  readonly reason: SubscriptionVerificationFailure;

  constructor(reason: SubscriptionVerificationFailure) {
    super(reason === "permission"
      ? "No pudimos acceder a esta suscripción de Mercado Pago. Conservamos tu plan mientras se revisa la conexión."
      : reason === "not_found"
        ? "No pudimos encontrar esta suscripción en Mercado Pago. Conservamos tu plan mientras se revisa la referencia."
        : "Mercado Pago no está disponible para verificar la suscripción en este momento. Conservamos tu plan y dejamos la verificación en pausa.");
    this.name = "SubscriptionVerificationError";
    this.reason = reason;
  }
}

export function classifySubscriptionVerificationFailure(status: number, message?: string): SubscriptionVerificationFailure {
  if (status === 404) return "not_found";
  if (status === 401 || status === 403 || isInvalidCallerPreapprovalError(message ?? "")) return "permission";
  return "temporary";
}


export function parseSubscriptionVerificationNotice(value: unknown): SubscriptionVerificationNotice | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.reason !== "not_found" && candidate.reason !== "permission" && candidate.reason !== "temporary") return undefined;
  return { ...(candidate.needsReview === true ? { needsReview: true } : {}), reason: candidate.reason, retryAt: typeof candidate.retryAt === "string" ? candidate.retryAt : null, showNotice: candidate.showNotice === true };
}
