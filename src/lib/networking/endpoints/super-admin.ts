"use client";

import { getAccessToken } from "@/lib/networking/endpoints/auth";
import { getResponseErrorMessage } from "@/lib/networking/response-errors";

export type SuperAdminBusiness = {
  businessId: string;
  businessName: string;
  employeeCount: number;
  isReferralPro: boolean;
  monthlyAppointmentCount: number;
  monthlyCancelledCount: number;
  monthlyPaidSubscriptionCount: number;
  monthlySubscriptionRevenue: number;
  ownerCreatedAt: string;
  ownerEmail: string;
  ownerEmailVerified: boolean;
  ownerLastSignInAt: string;
  ownerProvider: string;
  plan: string;
  providerStatus: string;
  providerSubscriptionId: string;
  referralActiveDaysRemaining: number;
  referralAvailableMonths: number;
  referralCode: string;
  referralPremiumCount: number;
  referralRegisteredCount: number;
  referredByCode: string;
  serviceCount: number;
  subscriptionTier: string;
  totalPaidSubscriptionCount: number;
  totalSubscriptionRevenue: number;
};

export type SuperAdminAction = "activatePro" | "downgradeFree";

export async function getSuperAdminStatus() {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/super-admin/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, "Unable to load super admin status."));
  }

  const payload = await response.json() as {
    isSuperAdmin?: boolean;
  };

  return Boolean(payload.isSuperAdmin);
}

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
