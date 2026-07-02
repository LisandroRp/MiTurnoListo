"use client";

import { BusinessPaymentSettings } from "@/features/scheduling/types";
import { getSupabaseBrowserClient } from "@/lib/networking/clients/supabase-browser";

export async function getPaymentSettings(businessId: string) {
  const accessToken = await getAccessToken();
  const response = await fetch(`/api/payment-settings?businessId=${encodeURIComponent(businessId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("Unable to load payment settings.");
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
    throw new Error("Unable to save payment settings.");
  }

  return response.json() as Promise<BusinessPaymentSettings>;
}

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error("Missing authenticated session.");
  }

  return data.session.access_token;
}
