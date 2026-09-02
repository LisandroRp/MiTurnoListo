"use client";

import { Locale, PaymentMethod, ThemeId } from "@/features/scheduling/types";
import { getResponseErrorMessage } from "@/lib/networking/response-errors";

export type PublicServiceSummary = {
  capacity: number;
  deposit: number;
  description: string;
  durationMinutes: number;
  employeeNames: string[];
  id: string;
  name: string;
  paymentMethod: PaymentMethod;
  price: number;
  publicSlug: string;
};

export type PublicServicesPayload = {
  address: string;
  businessName: string;
  locale: Locale;
  publicDescription: string;
  publicLogoUrl: string;
  publicOpeningHours: string;
  services: PublicServiceSummary[];
  theme: ThemeId;
};

export async function getPublicServicesPayload(businessKey: string) {
  const response = await fetch(`/api/public-services/${businessKey}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, "Unable to load public services."));
  }

  return response.json() as Promise<PublicServicesPayload>;
}
