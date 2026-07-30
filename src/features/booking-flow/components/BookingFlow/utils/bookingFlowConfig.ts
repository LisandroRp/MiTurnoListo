import { BookingDraft } from "@/features/booking-flow/types";
import { createEmptyCustomer } from "@/features/booking-flow/utils/booking";
import { BusinessPaymentSettings } from "@/features/scheduling/types";

export const bookingStepOrder = ["service", "employee", "datetime", "details", "summary"] as const;

export const bookingLocaleMap = {
  es: "es-AR",
  en: "en-US"
} as const;

export const emptyPaymentSettings: BusinessPaymentSettings = {
  mercadoPago: {
    accessToken: "",
    publicKey: "",
    isConfigured: false
  },
  transfers: {
    accountHolder: "",
    cbu: "",
    alias: "",
    receiptWhatsapp: ""
  }
};

export function createInitialBookingDraft(): BookingDraft {
  return {
    employeeId: null,
    selectedSlot: null,
    paymentOption: null,
    customer: createEmptyCustomer(),
    partySize: 1
  };
}
