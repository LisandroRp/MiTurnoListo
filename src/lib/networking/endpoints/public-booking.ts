"use client";

import {
  Appointment,
  BusinessDayBlock,
  BusinessPaymentSettings,
  Employee,
  Locale,
  Service,
  ThemeId
} from "@/features/scheduling/types";
import { getPayloadErrorMessage, getResponseErrorMessage } from "@/lib/networking/response-errors";

export type PublicBookingPayload = {
  address: string;
  appointments: Appointment[];
  businessName: string;
  businessDayBlocks: BusinessDayBlock[];
  employees: Employee[];
  locale: Locale;
  paymentSettings: BusinessPaymentSettings;
  publicDescription: string;
  publicLogoUrl: string;
  publicOpeningHours: string;
  service: Service;
  theme: ThemeId;
};

export type PublicBookingUnavailableDetails = {
  businessName: string;
  locale: Locale;
  publicLogoUrl: string;
  reason: "NO_VISIBLE_EMPLOYEES" | "SERVICE_NOT_PUBLIC" | "UNKNOWN";
  theme: ThemeId;
};

export class PublicBookingUnavailableError extends Error {
  details: PublicBookingUnavailableDetails;

  constructor(details: PublicBookingUnavailableDetails) {
    super("SERVICE_UNAVAILABLE");
    this.name = "PublicBookingUnavailableError";
    this.details = details;
  }
}

export type CreatePublicBookingInput = {
  customer: {
    email: string;
    fullName: string;
    phone: string;
  };
  employeeId: string;
  addonIds: string[];
  partySize: number;
  paymentMethod: Exclude<Appointment["paymentMethod"], "mixed">;
  timeZone: string;
  slot: {
    date: string;
    endTime: string;
    startTime: string;
  };
};

export async function getPublicBookingPayload(serviceId: string) {
  const response = await fetch(`/api/public-booking/${serviceId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await readJsonResponse(response);

    if (isUnavailablePayload(payload)) {
      throw new PublicBookingUnavailableError({
        businessName: payload.businessName,
        locale: payload.locale,
        publicLogoUrl: payload.publicLogoUrl,
        reason: payload.reason,
        theme: payload.theme
      });
    }

    throw new Error(getPayloadErrorMessage(payload, "Unable to load the public booking page."));
  }

  return response.json() as Promise<PublicBookingPayload>;
}

export async function createPublicBooking(serviceId: string, payload: CreatePublicBookingInput) {
  const response = await fetch(`/api/public-booking/${serviceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, "Unable to create the booking."));
  }

  return response.json() as Promise<{
    appointmentId: string;
    checkoutUrl?: string;
  }>;
}

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text().catch(() => "");

    return text.trim();
  }

  return response.json().catch(() => null) as Promise<unknown>;
}

function isUnavailablePayload(payload: unknown): payload is PublicBookingUnavailableDetails & { error: "SERVICE_UNAVAILABLE" } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const record = payload as Record<string, unknown>;

  return (
    record.error === "SERVICE_UNAVAILABLE" &&
    typeof record.businessName === "string" &&
    typeof record.locale === "string" &&
    typeof record.publicLogoUrl === "string" &&
    isUnavailableReason(record.reason) &&
    typeof record.theme === "string"
  );
}

function isUnavailableReason(reason: unknown): reason is PublicBookingUnavailableDetails["reason"] {
  return reason === "NO_VISIBLE_EMPLOYEES" || reason === "SERVICE_NOT_PUBLIC" || reason === "UNKNOWN";
}
