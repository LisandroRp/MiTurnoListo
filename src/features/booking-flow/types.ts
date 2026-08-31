import { BookingCustomer, PaymentMethod } from "@/features/scheduling/types";

export type BookingPaymentOption = "transfer" | "mercadoPago" | "cash";

export type BookingSlot = {
  date: string;
  startTime: string;
  endTime: string;
  remainingCapacity: number;
  employeeAvailability: BookingSlotEmployeeAvailability[];
};

export type BookingSlotEmployeeAvailability = {
  employeeId: string;
  remainingCapacity: number;
};

export type BookingDraft = {
  employeeId: string | null;
  selectedAddonIds: string[];
  selectedSlot: BookingSlot | null;
  paymentOption: BookingPaymentOption | null;
  customer: BookingCustomer;
  partySize: number;
};

export type BookingCustomerSuggestion = BookingCustomer & {
  id: string;
};

export type BookingSummary = {
  paymentMethod: PaymentMethod;
  total: number;
  deposit: number;
};
