import "server-only";

import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { SubscriptionVerificationError, type SubscriptionVerificationNotice } from "@/lib/mercadopago/subscription-verification-policy";
import type { SubscriptionStatusResult } from "./subscriptions";

type VerificationClaim = {
  allowed: boolean;
  token?: string;
  failure_kind?: SubscriptionVerificationNotice["reason"] | null;
  retry_after?: string | null;
  needs_review?: boolean;
};

export async function withSubscriptionVerification({ businessId, reference, verify }: {
  businessId: string;
  reference: string;
  verify: () => Promise<SubscriptionStatusResult>;
}): Promise<SubscriptionStatusResult> {
  const supabase = getSupabaseAdminClient();
  const claimResult = await supabase.rpc("claim_subscription_verification", { p_business_id: businessId, p_reference: reference });
  if (claimResult.error || !claimResult.data) throw new Error("No pudimos preparar la verificación de tu plan. Intentá nuevamente más tarde.");
  const claim = claimResult.data as VerificationClaim;

  async function deferred(reason: SubscriptionVerificationNotice["reason"], retryAt: string | null, showNotice: boolean, needsReview = false): Promise<SubscriptionStatusResult> {
    const result = await supabase.from("businesses").select("subscription_tier").eq("id", businessId).single();
    if (result.error || !result.data) throw new Error("No pudimos consultar tu plan actual.");
    return {
      businessId, preapprovalId: "", status: "verification_deferred",
      subscriptionTier: result.data.subscription_tier,
      verification: { reason, retryAt, showNotice, ...(needsReview ? { needsReview: true } : {}) }
    };
  }

  if (!claim.allowed) return deferred(claim.failure_kind ?? "temporary", claim.retry_after ?? null, false, Boolean(claim.needs_review));
  if (!claim.token) throw new Error("No pudimos iniciar la verificación de la suscripción.");

  async function finish(outcome: string, attempts: number) {
    const result = await supabase.rpc("finish_subscription_verification", {
      p_business_id: businessId, p_reference: reference, p_token: claim.token,
      p_outcome: outcome, p_attempts: attempts
    });
    if (result.error) throw new Error("No pudimos guardar el resultado de la verificación de la suscripción.");
    return result.data as { applied: boolean; retry_after?: string | null; needs_review?: boolean };
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let status: SubscriptionStatusResult;
    try {
      status = await verify();
    } catch (error) {
      if (!(error instanceof SubscriptionVerificationError)) {
        await finish("aborted", attempt);
        throw error;
      }
      if (error.reason === "temporary" && attempt === 1) continue;
      const finished = await finish(error.reason, attempt);
      return deferred(error.reason, finished?.retry_after ?? null, Boolean(finished?.applied) && error.reason !== "not_found", Boolean(finished?.needs_review));
    }
    await finish("success", attempt);
    return status;
  }
  throw new Error("No pudimos completar la verificación de la suscripción.");
}
