"use client";

import { PaymentRecord } from "@/features/scheduling/types";
import { getAccessToken } from "@/lib/networking/endpoints/auth";
import { getResponseErrorMessage } from "@/lib/networking/response-errors";

export async function getPayments(businessId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(`/api/payments?businessId=${encodeURIComponent(businessId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, "Unable to load payments."));
  }

  const payload = await response.json() as {
    payments?: PaymentRecord[];
  };

  return payload.payments ?? [];
}
