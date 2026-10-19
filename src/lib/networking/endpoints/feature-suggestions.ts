"use client";

import { getAccessToken } from "@/lib/networking/endpoints/auth";
import { getPayloadErrorMessage } from "@/lib/networking/response-errors";
import type { FeatureSuggestionStatus } from "@/lib/feature-suggestions";

export type FeatureSuggestion = {
  businessId: string;
  businessName: string;
  createdAt: string;
  description: string;
  id: string;
  reviewedAt: string | null;
  status: FeatureSuggestionStatus;
  submittedByEmail: string;
  title: string;
};

export type FeatureSuggestionAvailability = {
  canSubmitToday: boolean;
  submittedToday: FeatureSuggestion | null;
};

export class FeatureSuggestionRequestError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "FeatureSuggestionRequestError";
    this.code = code;
  }
}

export async function getFeatureSuggestionAvailability(businessId: string) {
  const response = await fetch(`/api/feature-suggestions?businessId=${encodeURIComponent(businessId)}`, {
    headers: await getAuthorizationHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    throw await createRequestError(response, "Unable to load feature suggestion availability.");
  }

  return await response.json() as FeatureSuggestionAvailability;
}

export async function submitFeatureSuggestion(businessId: string, title: string, description: string) {
  const response = await fetch("/api/feature-suggestions", {
    method: "POST",
    headers: {
      ...await getAuthorizationHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ businessId, description, title })
  });

  if (!response.ok) {
    throw await createRequestError(response, "Unable to submit the feature suggestion.");
  }

  const payload = await response.json() as { data: FeatureSuggestion };
  return payload.data;
}

export async function getSuperAdminFeatureSuggestions() {
  const response = await fetch("/api/feature-suggestions?scope=all", {
    headers: await getAuthorizationHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    throw await createRequestError(response, "Unable to load feature suggestions.");
  }

  const payload = await response.json() as { data?: FeatureSuggestion[] };
  return payload.data ?? [];
}

export async function updateFeatureSuggestionStatus(id: string, status: FeatureSuggestionStatus) {
  const response = await fetch("/api/feature-suggestions", {
    method: "PATCH",
    headers: {
      ...await getAuthorizationHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id, status })
  });

  if (!response.ok) {
    throw await createRequestError(response, "Unable to update the feature suggestion.");
  }

  const payload = await response.json() as {
    data: {
      id: string;
      reviewedAt: string | null;
      status: FeatureSuggestionStatus;
    };
  };

  return payload.data;
}

async function getAuthorizationHeaders() {
  return {
    Authorization: `Bearer ${await getAccessToken()}`
  };
}

async function createRequestError(response: Response, fallbackMessage: string) {
  const payload = await response.json().catch(() => null) as { code?: string } | null;
  return new FeatureSuggestionRequestError(getPayloadErrorMessage(payload, fallbackMessage), payload?.code);
}
