"use client";

import { ReferralSummary } from "@/features/scheduling/types";
import { getAccessToken } from "@/lib/networking/endpoints/auth";

type ReferralResponse = {
  error?: string;
  summary?: ReferralSummary;
};

export async function getReferralSummary() {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/referrals", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null) as ReferralResponse | null;

  if (!response.ok || !payload?.summary) {
    throw new Error(payload?.error ?? "No pudimos cargar tu plan de referidos.");
  }

  return payload.summary;
}

export async function activateReferralProgram() {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/referrals", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });
  const payload = await response.json().catch(() => null) as ReferralResponse | null;

  if (!response.ok || !payload?.summary) {
    throw new Error(payload?.error ?? "No pudimos activar tu código de referidos.");
  }

  return payload.summary;
}
