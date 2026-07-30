"use client";

import { Customer } from "@/features/scheduling/types";
import { getAccessToken } from "@/lib/networking/endpoints/auth";
import { getResponseErrorMessage } from "@/lib/networking/response-errors";

export async function getCustomers(businessId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(`/api/customers?businessId=${encodeURIComponent(businessId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, "Unable to load customers."));
  }

  const payload = await response.json() as {
    customers?: Customer[];
  };

  return payload.customers ?? [];
}
