"use client";

import { getSupabaseBrowserClient } from "@/lib/networking/clients/supabase-browser";
import { getBrowserTimeZone } from "@/lib/networking/utils/date-time";
import { normalizeReferralCode } from "@/lib/referral-rules";

type BootstrapWorkspaceResponse = {
  businessId: string;
  referralCodeConsumed?: boolean;
  role: string;
};

const referralStorageKey = "miturnolisto_referral_code";
const referralCookieName = "miturnolisto_referral_code";

export async function bootstrapWorkspace(accessToken?: string) {
  const token = accessToken ?? await getAccessToken();
  const response = await fetch("/api/auth/bootstrap", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      referralCode: getPendingReferralCode(),
      timeZone: getBrowserTimeZone()
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "Unable to load the workspace.");
  }

  const payload = await response.json() as BootstrapWorkspaceResponse;
  clearPendingReferralCode();

  return payload;
}

export async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error("Missing authenticated session.");
  }

  return data.session.access_token;
}

export function storePendingReferralCode(value: string | null | undefined) {
  const referralCode = normalizeReferralCode(value);

  if (!referralCode) {
    return;
  }

  window.localStorage.setItem(referralStorageKey, referralCode);
  document.cookie = `${referralCookieName}=${encodeURIComponent(referralCode)}; Max-Age=${60 * 60 * 24 * 60}; Path=/; SameSite=Lax`;
}

export function getPendingReferralCode() {
  const storedReferral = normalizeReferralCode(window.localStorage.getItem(referralStorageKey));

  if (storedReferral) {
    return storedReferral;
  }

  return normalizeReferralCode(getCookieValue(referralCookieName));
}

export function clearPendingReferralCode() {
  window.localStorage.removeItem(referralStorageKey);
  document.cookie = `${referralCookieName}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function getCookieValue(name: string) {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : "";
}
