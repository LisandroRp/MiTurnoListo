"use client";

import { Locale, PaymentMethod, ThemeId } from "@/features/scheduling/types";
import { getResponseErrorMessage } from "@/lib/networking/response-errors";

export type PublicServiceSummary = {
  capacity: number;
  deposit: number;
  description: string;
  durationMinutes: number;
  id: string;
  imageUrl: string;
  name: string;
  paymentMethod: PaymentMethod;
  price: number;
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

export async function getPublicServicesPayload(businessId: string) {
  const response = await fetch(`/api/public-services/${businessId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, "Unable to load public services."));
  }

  return response.json() as Promise<PublicServicesPayload>;
}
