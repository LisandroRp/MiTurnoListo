"use client";

import { getAccessToken } from "@/lib/networking/endpoints/auth";
import { getResponseErrorMessage } from "@/lib/networking/response-errors";

export type SuperAdminBusiness = {
  businessId: string;
  businessName: string;
  employeeCount: number;
  monthlyAppointmentCount: number;
  monthlyCancelledCount: number;
  monthlyRevenue: number;
  ownerCreatedAt: string;
  ownerEmail: string;
  ownerEmailVerified: boolean;
  ownerLastSignInAt: string;
  ownerProvider: string;
  plan: string;
  providerStatus: string;
  providerSubscriptionId: string;
  serviceCount: number;
  subscriptionTier: string;
};

export type SuperAdminAction = "activatePro" | "downgradeFree";

export async function getSuperAdminBusinesses() {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/super-admin/businesses", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (response.status === 403) {
    throw new Error("SUPER_ADMIN_FORBIDDEN");
  }

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, "Unable to load super admin businesses."));
  }

  const payload = await response.json() as {
    data?: SuperAdminBusiness[];
  };

  return payload.data ?? [];
}

export async function runSuperAdminBusinessAction(businessId: string, action: SuperAdminAction) {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/super-admin/businesses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action,
      businessId
    })
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, "Unable to update the business."));
  }
}
