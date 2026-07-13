"use client";

import { getSupabaseBrowserClient } from "@/lib/networking/clients/supabase-browser";
import { getBrowserTimeZone } from "@/lib/networking/utils/date-time";

type BootstrapWorkspaceResponse = {
  businessId: string;
  role: string;
};

export async function bootstrapWorkspace(accessToken?: string) {
  const token = accessToken ?? await getAccessToken();
  const response = await fetch("/api/auth/bootstrap", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      timeZone: getBrowserTimeZone()
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || "Unable to prepare the workspace.");
  }

  return response.json() as Promise<BootstrapWorkspaceResponse>;
}

export async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.access_token) {
    throw new Error("Missing authenticated session.");
  }

  return data.session.access_token;
}
