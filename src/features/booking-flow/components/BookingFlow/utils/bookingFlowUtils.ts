import { BookingDraft } from "@/features/booking-flow/types";
import { bookingStepOrder } from "@/features/booking-flow/components/BookingFlow/utils/bookingFlowConfig";
import { formatLongDate } from "@/features/booking-flow/utils/booking";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Service } from "@/features/scheduling/types";

export function buildWhatsAppHref(phone: string, message?: string) {
  const normalizedPhone = phone.replace(/\D/g, "");
  const encodedMessage = message ? `?text=${encodeURIComponent(message)}` : "";

  return `https://wa.me/${normalizedPhone}${encodedMessage}`;
}

export function buildReceiptWhatsappMessage(
  messages: Messages,
  locale: string,
  service: Service,
  draft: BookingDraft
) {
  const date = draft.selectedSlot ? formatLongDate(draft.selectedSlot.date, locale) : "-";
  const time = draft.selectedSlot ? `${draft.selectedSlot.startTime} - ${draft.selectedSlot.endTime}` : "-";

  return messages.bookingFlow.transferReceiptWhatsappMessage
    .replace("{serviceName}", service.name)
    .replace("{customerName}", draft.customer.fullName || "-")
    .replace("{date}", date)
    .replace("{time}", time);
}

export function getStepValidationMessage(step: typeof bookingStepOrder[number], draft: BookingDraft, messages: Messages) {
  if (step === "employee" && !draft.employeeId) {
    return messages.bookingFlow.validation.employeeRequired;
  }

  if (step === "datetime" && !draft.selectedSlot) {
    return messages.bookingFlow.validation.slotRequired;
  }

  if (step === "details") {
    if (!draft.customer.fullName.trim()) {
      return messages.bookingFlow.validation.nameRequired;
    }

    if (!draft.customer.phone.trim()) {
      return messages.bookingFlow.validation.phoneRequired;
    }

    if (!draft.customer.email.trim()) {
      return messages.bookingFlow.validation.emailRequired;
    }

    if (!isValidEmail(draft.customer.email)) {
      return messages.bookingFlow.validation.emailInvalid;
    }

    if (!draft.paymentOption) {
      return messages.bookingFlow.validation.paymentRequired;
    }
  }

  return "";
}

export function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
