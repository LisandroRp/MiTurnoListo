"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/composed/BrandMark";
import { StepProgress } from "@/components/composed/StepProgress";
import { AvailabilityHourList } from "@/features/booking-flow/components/AvailabilityCalendar";
import { BookingShell } from "@/features/booking-flow/components/BookingFlow/layout/BookingShell";
import { BookingSidebar } from "@/features/booking-flow/components/BookingFlow/layout/BookingSidebar";
import { BookingWizardActions } from "@/features/booking-flow/components/BookingFlow/layout/BookingWizardActions";
import { DateTimeStep } from "@/features/booking-flow/components/BookingFlow/steps/DateTimeStep";
import { DetailsStep } from "@/features/booking-flow/components/BookingFlow/steps/DetailsStep";
import { EmployeeStep } from "@/features/booking-flow/components/BookingFlow/steps/EmployeeStep";
import { ServiceStep } from "@/features/booking-flow/components/BookingFlow/steps/ServiceStep";
import { StateCard } from "@/features/booking-flow/components/BookingFlow/shared/bookingFlowPrimitives";
import {
  bookingLocaleMap,
  bookingStepOrder,
  createInitialBookingDraft,
  emptyPaymentSettings
} from "@/features/booking-flow/components/BookingFlow/utils/bookingFlowConfig";
import { getErrorMessage, getStepValidationMessage } from "@/features/booking-flow/components/BookingFlow/utils/bookingFlowUtils";
import { SuccessState } from "@/features/booking-flow/components/BookingFlow/shared/SuccessState";
import { SummaryStep } from "@/features/booking-flow/components/BookingFlow/steps/SummaryStep";
import {
  getAvailablePaymentOptions,
  getAvailableSlotsForEmployee,
  mapPaymentOptionToMethod
} from "@/features/booking-flow/utils/booking";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";
import { messages as schedulingMessages } from "@/features/scheduling/i18n/messages";
import { Locale, ThemeId } from "@/features/scheduling/types";
import {
  createPublicBooking,
  getPublicBookingPayload,
  PublicBookingPayload
} from "@/lib/networking/endpoints/public-booking";
import { getBrowserTimeZone } from "@/lib/networking/utils/date-time";

type BookingFlowProps = {
  serviceId: string;
  mode?: "public" | "preview";
};

export function BookingFlow({ serviceId, mode = "public" }: BookingFlowProps) {
  const {
    appointments: previewAppointments,
    employees: previewEmployees,
    locale: previewLocale,
    paymentSettings: previewPaymentSettings,
    profile,
    services: previewServices,
    theme: previewTheme
  } = useScheduling();
  const isPreview = mode === "preview";
  const [publicPayload, setPublicPayload] = useState<PublicBookingPayload | null>(null);
  const [isPublicLoading, setIsPublicLoading] = useState(!isPreview);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [draft, setDraft] = useState(createInitialBookingDraft);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [topToastMessage, setTopToastMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const topToastTimeoutRef = useRef<number | null>(null);
  const locale: Locale = isPreview ? previewLocale : publicPayload?.locale ?? "es";
  const messages = schedulingMessages[locale];
  const copy = messages.bookingFlow;
  const theme: ThemeId = isPreview ? previewTheme : publicPayload?.theme ?? "coral";
  const service = isPreview ? previewServices.find((item) => item.id === serviceId) : publicPayload?.service;
  const employees = isPreview ? previewEmployees : publicPayload?.employees ?? [];
  const appointments = isPreview ? previewAppointments : publicPayload?.appointments ?? [];
  const paymentSettings = isPreview ? previewPaymentSettings : publicPayload?.paymentSettings ?? emptyPaymentSettings;
  const localeCode = bookingLocaleMap[locale];
  const stepItems = bookingStepOrder.map((step) => ({
    id: step,
    label: messages.bookingFlow.steps[step]
  }));

  useEffect(() => {
    if (isPreview) {
      setPublicPayload(null);
      setPublicError(null);
      setIsPublicLoading(false);
      return;
    }

    let isActive = true;

    setDraft(createInitialBookingDraft());
    setCurrentStepIndex(0);
    setMonthDate(new Date());
    setSelectedDate(null);
    setValidationMessage("");
    setTopToastMessage("");
    setIsSubmitting(false);
    setPublicError(null);
    setIsPublicLoading(true);

    void getPublicBookingPayload(serviceId)
      .then((payload) => {
        if (!isActive) {
          return;
        }

        setPublicPayload(payload);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setPublicError(getErrorMessage(error, schedulingMessages.es.bookingFlow.loadErrorTitle));
      })
      .finally(() => {
        if (isActive) {
          setIsPublicLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [isPreview, serviceId]);

  const assignedEmployees = service
    ? employees.filter((employee) => service.employeeIds.includes(employee.id))
    : [];
  const selectedEmployee = assignedEmployees.find((employee) => employee.id === draft.employeeId) ?? null;
  const availablePaymentOptions = service ? getAvailablePaymentOptions(service, paymentSettings) : [];
  const availableSlots = service && selectedEmployee
    ? getAvailableSlotsForEmployee(service, selectedEmployee, appointments, monthDate, draft.partySize)
    : [];
  const selectedPaymentOption = draft.paymentOption && availablePaymentOptions.includes(draft.paymentOption)
    ? draft.paymentOption
    : availablePaymentOptions.length === 1
      ? availablePaymentOptions[0]
      : null;
  const selectedSlot = draft.selectedSlot && availableSlots.some((slot) => (
    slot.date === draft.selectedSlot?.date &&
    slot.startTime === draft.selectedSlot?.startTime
  ))
    ? draft.selectedSlot
    : null;

  if (!isPreview && isPublicLoading) {
    return (
      <BookingShell className="place-items-center" theme={theme} mode={mode}>
        <StateCard title={copy.loadingTitle} description={copy.loadingDescription} />
      </BookingShell>
    );
  }

  if (!isPreview && publicError) {
    return (
      <BookingShell theme={theme} mode={mode}>
        <StateCard title={copy.loadErrorTitle} description={publicError} />
      </BookingShell>
    );
  }

  if (!service) {
    return (
      <BookingShell theme={theme} mode={mode}>
        <StateCard title={copy.serviceNotFound} />
      </BookingShell>
    );
  }

  if (!service.isVisible) {
    return (
      <BookingShell theme={theme} mode={mode}>
        <StateCard title={copy.hiddenService} />
      </BookingShell>
    );
  }

  const currentStep = bookingStepOrder[currentStepIndex];
  const actionButtonLabel = currentStep !== "summary" ? messages.actions.continue : messages.actions.confirmReservation;
  const isDateTimeStep = currentStep === "datetime";

  function goToNextStep() {
    const nextValidationMessage = getStepValidationMessage(
      currentStep,
      { ...draft, paymentOption: selectedPaymentOption, selectedSlot },
      messages
    );

    if (nextValidationMessage) {
      setValidationMessage(nextValidationMessage);
      return;
    }

    setValidationMessage("");
    setCurrentStepIndex((current) => Math.min(current + 1, bookingStepOrder.length - 1));
  }

  function goToPreviousStep() {
    setValidationMessage("");
    setCurrentStepIndex((current) => Math.max(current - 1, 0));
  }

  function restartBookingFlow() {
    setDraft(createInitialBookingDraft());
    setCurrentStepIndex(0);
    setMonthDate(new Date());
    setSelectedDate(null);
    setValidationMessage("");
    setTopToastMessage("");
    setIsSubmitting(false);
  }

  function showTopToast(message: string) {
    if (topToastTimeoutRef.current) {
      window.clearTimeout(topToastTimeoutRef.current);
    }

    setTopToastMessage(message);
    topToastTimeoutRef.current = window.setTimeout(() => setTopToastMessage(""), 3500);
  }

  async function confirmReservation() {
    if (!service || !selectedEmployee || !selectedSlot || !selectedPaymentOption) {
      return;
    }

    if (isPreview) {
      setValidationMessage(copy.previewBlocked);
      return;
    }

    setIsSubmitting(true);
    setValidationMessage("");

    try {
      const bookingResult = await createPublicBooking(service.id, {
        customer: draft.customer,
        employeeId: selectedEmployee.id,
        partySize: draft.partySize,
        paymentMethod: mapPaymentOptionToMethod(selectedPaymentOption),
        timeZone: getBrowserTimeZone(),
        slot: {
          date: selectedSlot.date,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime
        }
      });

      if (bookingResult.checkoutUrl) {
        window.location.assign(bookingResult.checkoutUrl);
        return;
      }

      setCurrentStepIndex(bookingStepOrder.length);
    } catch (error) {
      setValidationMessage(getErrorMessage(error, copy.submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <BookingShell theme={theme} mode={mode}>
      {topToastMessage ? (
        <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-warning bg-warning-soft p-4 text-sm font-bold text-warning shadow-lg">
          {topToastMessage}
        </div>
      ) : null}
      {currentStepIndex < bookingStepOrder.length ? (
        <>
          <header className="grid gap-4">
            {!isPreview ? (
              <Link href="/" className="inline-flex w-full cursor-pointer items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-primary">
                <BrandMark variant="full" size="sm" />
              </Link>
            ) : null}
            <StepProgress steps={stepItems} currentStepIndex={currentStepIndex} onStepSelect={setCurrentStepIndex} />
            <BookingWizardActions
              backLabel={messages.actions.back}
              currentStepIndex={currentStepIndex}
              isSubmitDisabled={isPreview && currentStep === "summary"}
              isSubmitting={isSubmitting && currentStep === "summary"}
              submitLabel={isPreview && currentStep === "summary" ? copy.previewBlocked : actionButtonLabel}
              onNext={currentStep !== "summary" ? goToNextStep : () => void confirmReservation()}
              onPrevious={goToPreviousStep}
            />
            {validationMessage ? (
              <div className="rounded-2xl border border-danger bg-danger-soft p-4 text-sm font-semibold text-danger">
                {validationMessage}
              </div>
            ) : null}
          </header>

          <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="grid items-start gap-6">
              {currentStep === "service" ? (
                <ServiceStep
                  messages={messages}
                  service={service}
                  selectedPartySize={draft.partySize}
                  onPartySizeChange={(partySize) => setDraft((current) => ({ ...current, partySize }))}
                />
              ) : null}

              {currentStep === "employee" ? (
                <EmployeeStep
                  messages={messages}
                  employees={assignedEmployees}
                  selectedEmployeeId={draft.employeeId}
                  onSelectEmployee={(employeeId) => {
                    setSelectedDate(null);
                    setDraft((current) => ({
                      ...current,
                      employeeId,
                      selectedSlot: null
                    }));
                  }}
                />
              ) : null}

              {currentStep === "datetime" ? (
                <DateTimeStep
                  messages={messages}
                  locale={localeCode}
                  selectedEmployee={selectedEmployee?.name ?? ""}
                  monthDate={monthDate}
                  slots={availableSlots}
                  selectedSlotDate={selectedSlot?.date ?? selectedDate}
                  selectedSlotTime={selectedSlot?.startTime ?? null}
                  onMonthChange={setMonthDate}
                  onSelectDate={(date) => {
                    setSelectedDate(date);
                    setDraft((current) => (
                      current.selectedSlot?.date === date
                        ? current
                        : { ...current, selectedSlot: null }
                    ));
                  }}
                  onSelectSlot={(slot) => {
                    setSelectedDate(slot.date);
                    setDraft((current) => ({ ...current, selectedSlot: slot }));
                  }}
                />
              ) : null}

              {currentStep === "details" ? (
                <DetailsStep
                  messages={messages}
                  locale={localeCode}
                  service={service}
                  availablePaymentOptions={availablePaymentOptions}
                  selectedPaymentOption={selectedPaymentOption}
                  customer={draft.customer}
                  draft={{ ...draft, paymentOption: selectedPaymentOption, selectedSlot }}
                  paymentSettingsText={paymentSettings.transfers}
                  onPaymentOptionChange={(paymentOption) => setDraft((current) => ({ ...current, paymentOption }))}
                  onMissingCustomerName={() => showTopToast(messages.bookingFlow.validation.nameRequired)}
                  onCustomerChange={(field, value) => setDraft((current) => ({
                    ...current,
                    customer: { ...current.customer, [field]: value }
                  }))}
                />
              ) : null}

              {currentStep === "summary" ? (
                <SummaryStep
                  messages={messages}
                  locale={localeCode}
                  service={service}
                  employeeName={selectedEmployee?.name ?? ""}
                  draft={{ ...draft, paymentOption: selectedPaymentOption, selectedSlot }}
                />
              ) : null}
            </div>

            {isDateTimeStep ? (
              <div className="hidden lg:block">
                <AvailabilityHourList
                  messages={messages}
                  locale={localeCode}
                  selectedDate={selectedSlot?.date ?? selectedDate}
                  slots={
                    (selectedSlot?.date ?? selectedDate)
                      ? availableSlots.filter((slot) => slot.date === (selectedSlot?.date ?? selectedDate))
                      : []
                  }
                  selectedStartTime={selectedSlot?.startTime ?? null}
                  onSelectSlot={(slot) => {
                    setSelectedDate(slot.date);
                    setDraft((current) => ({ ...current, selectedSlot: slot }));
                  }}
                />
              </div>
            ) : (
              <BookingSidebar
                messages={messages}
                locale={localeCode}
                service={service}
                selectedEmployeeName={selectedEmployee?.name ?? null}
                draft={{ ...draft, paymentOption: selectedPaymentOption, selectedSlot }}
              />
            )}
          </div>

          <BookingWizardActions
            backLabel={messages.actions.back}
            currentStepIndex={currentStepIndex}
            isSubmitDisabled={isPreview && currentStep === "summary"}
            isSubmitting={isSubmitting && currentStep === "summary"}
            submitLabel={isPreview && currentStep === "summary" ? copy.previewBlocked : actionButtonLabel}
            onNext={currentStep !== "summary" ? goToNextStep : () => void confirmReservation()}
            onPrevious={goToPreviousStep}
          />
        </>
      ) : (
        <SuccessState
          messages={messages}
          locale={localeCode}
          service={service}
          draft={{ ...draft, paymentOption: selectedPaymentOption, selectedSlot }}
          employeeName={selectedEmployee?.name ?? ""}
          paymentSettings={paymentSettings.transfers}
          onMissingCustomerName={() => showTopToast(messages.bookingFlow.validation.nameRequired)}
          onReserveAnother={restartBookingFlow}
        />
      )}
    </BookingShell>
  );
}
