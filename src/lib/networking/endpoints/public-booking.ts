"use client";

import {
  Appointment,
  BusinessPaymentSettings,
  Employee,
  Locale,
  Service,
  ThemeId
} from "@/features/scheduling/types";
import { getResponseErrorMessage } from "@/lib/networking/response-errors";

export type PublicBookingPayload = {
  address: string;
  appointments: Appointment[];
  businessName: string;
  employees: Employee[];
  locale: Locale;
  paymentSettings: BusinessPaymentSettings;
  publicDescription: string;
  publicLogoUrl: string;
  publicOpeningHours: string;
  service: Service;
  theme: ThemeId;
};

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
    throw new Error(await getResponseErrorMessage(response, "Unable to load the public booking page."));
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
