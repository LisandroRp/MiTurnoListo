"use client";

import { BusinessPaymentSettings } from "@/features/scheduling/types";
import { getAccessToken } from "@/lib/networking/endpoints/auth";
import { getResponseErrorMessage } from "@/lib/networking/response-errors";

export async function getPaymentSettings(businessId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(`/api/payment-settings?businessId=${encodeURIComponent(businessId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, "Unable to load payment settings."));
  }

  return response.json() as Promise<BusinessPaymentSettings>;
}

export async function savePaymentSettings(
  businessId: string,
  settings: BusinessPaymentSettings
) {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/payment-settings", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      businessId,
      settings
    })
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, "Unable to save payment settings."));
  }

  return response.json() as Promise<BusinessPaymentSettings>;
}
