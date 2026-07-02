"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { FiArrowLeft, FiCheckCircle, FiClock, FiMail, FiMapPin, FiPhone, FiShield, FiUser } from "react-icons/fi";

import { BrandMark } from "@/components/composed/BrandMark";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import {
  AvailabilityCalendar,
  AvailabilityHourList
} from "@/features/booking-flow/components/AvailabilityCalendar";
import { BookingDraft, BookingPaymentOption } from "@/features/booking-flow/types";
import {
  createEmptyCustomer,
  formatLongDate,
  getAvailablePaymentOptions,
  getAvailableSlotsForEmployee,
  mapPaymentOptionToMethod
} from "@/features/booking-flow/utils/booking";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";
import { employeeColorClasses } from "@/features/scheduling/components/employeeColors";
import { messages as schedulingMessages, Messages } from "@/features/scheduling/i18n/messages";
import { BusinessPaymentSettings, Employee, Locale, Service, ThemeId } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";
import {
  createPublicBooking,
  getPublicBookingPayload,
  PublicBookingPayload
} from "@/lib/networking/endpoints/public-booking";
import { getBrowserTimeZone } from "@/lib/networking/utils/date-time";

const stepOrder = ["service", "employee", "datetime", "details", "summary"] as const;
const localeMap = {
  es: "es-AR",
  en: "en-US"
} as const;

type BookingFlowProps = {
  serviceId: string;
  mode?: "public" | "preview";
};

const emptyPaymentSettings: BusinessPaymentSettings = {
  mercadoPago: {
    accessToken: "",
    publicKey: "",
    isConfigured: false
  },
  transfers: {
    accountHolder: "",
    cbu: "",
    alias: ""
  }
};

function createInitialDraft(): BookingDraft {
  return {
    employeeId: null,
    selectedSlot: null,
    paymentOption: null,
    customer: createEmptyCustomer(),
    partySize: 1
  };
}

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
  const [draft, setDraft] = useState<BookingDraft>(createInitialDraft);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const locale: Locale = isPreview ? previewLocale : publicPayload?.locale ?? "es";
  const messages = schedulingMessages[locale];
  const copy = messages.bookingFlow;
  const theme: ThemeId = isPreview ? previewTheme : publicPayload?.theme ?? "coral";
  const businessName = isPreview ? profile.businessName : publicPayload?.businessName ?? "MiTurnoListo";
  const service = isPreview ? previewServices.find((item) => item.id === serviceId) : publicPayload?.service;
  const employees = isPreview ? previewEmployees : publicPayload?.employees ?? [];
  const appointments = isPreview ? previewAppointments : publicPayload?.appointments ?? [];
  const paymentSettings = isPreview ? previewPaymentSettings : publicPayload?.paymentSettings ?? emptyPaymentSettings;
  const localeCode = localeMap[locale];

  useEffect(() => {
    if (isPreview) {
      setPublicPayload(null);
      setPublicError(null);
      setIsPublicLoading(false);
      return;
    }

    let isActive = true;

    setDraft(createInitialDraft());
    setCurrentStepIndex(0);
    setMonthDate(new Date());
    setSelectedDate(null);
    setValidationMessage("");
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
      <BookingShell theme={theme} mode={mode}>
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

  const currentStep = stepOrder[currentStepIndex];
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
    setCurrentStepIndex((current) => Math.min(current + 1, stepOrder.length - 1));
  }

  function goToPreviousStep() {
    setValidationMessage("");
    setCurrentStepIndex((current) => Math.max(current - 1, 0));
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
      await createPublicBooking(service.id, {
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
      setCurrentStepIndex(stepOrder.length);
    } catch (error) {
      setValidationMessage(getErrorMessage(error, copy.submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <BookingShell theme={theme} mode={mode}>
      {currentStepIndex < stepOrder.length ? (
        <>
          <header className="grid gap-4">
            {isPreview ? (
              <Card className="border-brand bg-brand-soft p-4">
                <p className="text-sm font-bold text-primary">{copy.previewTitle}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{copy.previewDescription}</p>
              </Card>
            ) : (
              <Link href="/" className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-muted hover:text-primary">
                <FiArrowLeft aria-hidden="true" />
                <BrandMark variant="full" size="sm" />
              </Link>
            )}
            <div className="grid gap-2">
              <Badge tone="brand" className="w-fit">{businessName}</Badge>
              <h1 className="text-3xl font-bold text-primary sm:text-4xl">{copy.title}</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted">{copy.subtitle}</p>
            </div>
            <StepIndicator
              messages={messages}
              currentStepIndex={currentStepIndex}
              onStepSelect={setCurrentStepIndex}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              {currentStepIndex > 0 ? (
                <Button variant="secondary" onClick={goToPreviousStep}>
                  {messages.actions.back}
                </Button>
              ) : (
                <span />
              )}

              <Button
                isLoading={isSubmitting && currentStep === "summary"}
                disabled={isPreview && currentStep === "summary"}
                onClick={currentStep !== "summary" ? goToNextStep : () => void confirmReservation()}
              >
                {isPreview && currentStep === "summary" ? copy.previewBlocked : actionButtonLabel}
              </Button>
            </div>
            {validationMessage ? (
              <div className="rounded-2xl border border-danger bg-danger-soft p-4 text-sm font-semibold text-danger">
                {validationMessage}
              </div>
            ) : null}
          </header>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-6">
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
                  availablePaymentOptions={availablePaymentOptions}
                  selectedPaymentOption={selectedPaymentOption}
                  customer={draft.customer}
                  paymentSettingsText={paymentSettings.transfers}
                  onPaymentOptionChange={(paymentOption) => setDraft((current) => ({ ...current, paymentOption }))}
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
        </>
      ) : (
        <SuccessState
          messages={messages}
          locale={localeCode}
          service={service}
          draft={{ ...draft, paymentOption: selectedPaymentOption, selectedSlot }}
          employeeName={selectedEmployee?.name ?? ""}
        />
      )}
    </BookingShell>
  );
}

function BookingShell({
  children,
  theme = "coral",
  mode = "public"
}: {
  children: ReactNode;
  theme?: string;
  mode?: "public" | "preview";
}) {
  return (
    <main className={cx(
      `theme-${theme} text-primary`,
      mode === "public" ? "min-h-screen bg-page px-4 py-8 sm:px-6 lg:px-8" : "bg-transparent"
    )}>
      <div className="mx-auto grid max-w-6xl gap-6">{children}</div>
    </main>
  );
}

function StepIndicator({
  messages,
  currentStepIndex,
  onStepSelect
}: {
  messages: Messages;
  currentStepIndex: number;
  onStepSelect: (index: number) => void;
}) {
  const stepEntries = Object.entries(messages.bookingFlow.steps);

  return (
    <div className="grid gap-3 sm:grid-cols-5">
      {stepEntries.map(([stepKey, label], index) => (
        <button
          key={stepKey}
          type="button"
          disabled={index > currentStepIndex}
          onClick={() => onStepSelect(index)}
          className={cx(
            "rounded-2xl border p-3 text-left transition-all",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            index <= currentStepIndex ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm" : "cursor-not-allowed opacity-60",
            index <= currentStepIndex ? "border-brand bg-brand-soft text-brand-strong" : "border-subtle bg-sidebar text-muted"
          )}
          aria-current={index === currentStepIndex ? "step" : undefined}
        >
          <p className="text-xs font-bold uppercase">0{index + 1}</p>
          <p className="mt-1 text-sm font-semibold">{label}</p>
        </button>
      ))}
    </div>
  );
}

function ServiceStep({
  messages,
  service,
  selectedPartySize,
  onPartySizeChange
}: {
  messages: Messages;
  service: Service;
  selectedPartySize: number;
  onPartySizeChange: (value: number) => void;
}) {
  const maxPeople = Math.max(service.capacity, 1);

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
        <div
          className="min-h-72 bg-surface-strong bg-cover bg-center"
          style={{ backgroundImage: `url(${service.imageUrl || ""})` }}
        />
        <div className="grid gap-5 p-6">
          <div>
            <Badge tone={service.isVisible ? "brand" : "warning"}>{messages.bookingFlow.steps.service}</Badge>
            <h2 className="mt-3 text-3xl font-bold text-primary">{service.name}</h2>
            <p className="mt-3 text-sm leading-6 text-muted">{service.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricPill label={messages.services.duration} value={`${service.durationMinutes} ${messages.services.minutes}`} />
            <MetricPill label={messages.services.price} value={formatCurrency(service.price)} />
            <MetricPill label={messages.bookingFlow.summary.deposit} value={formatCurrency(service.deposit)} />
            <MetricPill label={messages.services.capacity} value={`${service.capacity} ${messages.services.people}`} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-primary" htmlFor="party-size">
              {messages.bookingFlow.partySize}
            </label>
            <select
              id="party-size"
              value={selectedPartySize}
              onChange={(event) => onPartySizeChange(Number(event.target.value))}
              className="h-11 cursor-pointer rounded-xl border border-subtle bg-input px-3 text-sm text-primary outline-none focus:border-brand focus:ring-2 focus:ring-focus"
            >
              {Array.from({ length: maxPeople }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmployeeStep({
  messages,
  employees,
  selectedEmployeeId,
  onSelectEmployee
}: {
  messages: Messages;
  employees: Employee[];
  selectedEmployeeId: string | null;
  onSelectEmployee: (employeeId: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <Card className="bg-brand-soft">
        <h2 className="text-xl font-bold text-primary">{messages.bookingFlow.chooseEmployee}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{messages.bookingFlow.chooseEmployeeHint}</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {employees.map((employee) => (
          <button
            key={employee.id}
            type="button"
            onClick={() => onSelectEmployee(employee.id)}
            className={cx(
              "cursor-pointer rounded-3xl border bg-sidebar p-5 text-left transition-all",
              "hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              selectedEmployeeId === employee.id ? "border-brand bg-brand-soft" : "border-subtle"
            )}
          >
            <div className="flex items-center gap-3">
              <span className={cx("h-4 w-4 rounded-full", employeeColorClasses[employee.color])} />
              <div>
                <h3 className="text-lg font-bold text-primary">{employee.name}</h3>
                <p className="text-sm text-muted">{employee.role}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">{employee.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function DateTimeStep({
  messages,
  locale,
  selectedEmployee,
  monthDate,
  slots,
  selectedSlotDate,
  selectedSlotTime,
  onMonthChange,
  onSelectDate,
  onSelectSlot
}: {
  messages: Messages;
  locale: string;
  selectedEmployee: string;
  monthDate: Date;
  slots: ReturnType<typeof getAvailableSlotsForEmployee>;
  selectedSlotDate: string | null;
  selectedSlotTime: string | null;
  onMonthChange: (date: Date) => void;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slot: ReturnType<typeof getAvailableSlotsForEmployee>[number]) => void;
}) {
  return (
    <div className="grid gap-4">
      <Card className="bg-brand-soft">
        <h2 className="text-xl font-bold text-primary">{messages.bookingFlow.chooseDate}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {messages.bookingFlow.chooseDateHint}
          {selectedEmployee ? ` ${selectedEmployee}.` : ""}
        </p>
      </Card>
      {slots.length === 0 ? (
        <Card>
          <p className="text-sm font-semibold text-muted">{messages.bookingFlow.noDatesAvailable}</p>
        </Card>
      ) : null}
      <AvailabilityCalendar
        messages={messages}
        locale={locale}
        monthDate={monthDate}
        slots={slots}
        selectedDate={selectedSlotDate}
        selectedStartTime={selectedSlotTime}
        onMonthChange={onMonthChange}
        onSelectDate={onSelectDate}
        onSelectSlot={onSelectSlot}
        showDesktopHours={false}
      />
    </div>
  );
}

function DetailsStep({
  messages,
  availablePaymentOptions,
  selectedPaymentOption,
  customer,
  paymentSettingsText,
  onPaymentOptionChange,
  onCustomerChange
}: {
  messages: Messages;
  availablePaymentOptions: BookingPaymentOption[];
  selectedPaymentOption: BookingPaymentOption | null;
  customer: BookingDraft["customer"];
  paymentSettingsText: BusinessPaymentSettings["transfers"];
  onPaymentOptionChange: (option: BookingPaymentOption) => void;
  onCustomerChange: (field: keyof BookingDraft["customer"], value: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <Card className="bg-brand-soft">
        <h2 className="text-xl font-bold text-primary">{messages.bookingFlow.paymentTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{messages.bookingFlow.paymentHint}</p>
      </Card>

      <Card className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-3">
          {availablePaymentOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onPaymentOptionChange(option)}
              className={cx(
                "cursor-pointer rounded-2xl border p-4 text-left transition-all",
                selectedPaymentOption === option ? "border-brand bg-brand-soft text-brand-strong" : "border-subtle bg-input hover:-translate-y-0.5 hover:shadow-sm"
              )}
            >
              <p className="text-sm font-bold text-primary">{messages.bookingFlow.paymentOptions[option]}</p>
            </button>
          ))}
        </div>

        {selectedPaymentOption === "transfer" ? (
          <div className="rounded-2xl border border-subtle bg-input p-4">
            <h3 className="text-sm font-bold text-primary">{messages.bookingFlow.businessPaymentInfo}</h3>
            <div className="mt-3 grid gap-2 text-sm text-muted">
              <p>{paymentSettingsText.accountHolder}</p>
              <p>CBU: {paymentSettingsText.cbu}</p>
              <p>Alias: {paymentSettingsText.alias}</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <TextField
            label={messages.bookingFlow.customerName}
            value={customer.fullName}
            prefix={<FiUser />}
            onChange={(event) => onCustomerChange("fullName", event.target.value)}
          />
          <TextField
            label={messages.bookingFlow.customerPhone}
            value={customer.phone}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            prefix={<FiPhone />}
            onChange={(event) => onCustomerChange("phone", event.target.value.replace(/\D/g, ""))}
          />
          <div className="lg:col-span-2">
            <TextField
              label={messages.bookingFlow.customerEmail}
              type="email"
              value={customer.email}
              prefix={<FiMail />}
              onChange={(event) => onCustomerChange("email", event.target.value)}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

function SummaryStep({
  messages,
  locale,
  service,
  employeeName,
  draft
}: {
  messages: Messages;
  locale: string;
  service: Service;
  employeeName: string;
  draft: BookingDraft;
}) {
  return (
    <div className="grid gap-4">
      <Card className="bg-brand-soft">
        <h2 className="text-xl font-bold text-primary">{messages.bookingFlow.summaryTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{messages.bookingFlow.summaryHint}</p>
      </Card>
      <Card className="grid gap-4">
        <SummaryRow label={messages.bookingFlow.summary.service} value={service.name} />
        <SummaryRow label={messages.bookingFlow.summary.employee} value={employeeName} />
        <SummaryRow
          label={messages.bookingFlow.summary.date}
          value={draft.selectedSlot ? formatLongDate(draft.selectedSlot.date, locale) : "-"}
        />
        <SummaryRow
          label={messages.bookingFlow.summary.time}
          value={draft.selectedSlot ? `${draft.selectedSlot.startTime} - ${draft.selectedSlot.endTime}` : "-"}
        />
        <SummaryRow
          label={messages.bookingFlow.summary.payment}
          value={draft.paymentOption ? messages.bookingFlow.paymentOptions[draft.paymentOption] : "-"}
        />
        <SummaryRow label={messages.bookingFlow.summary.customer} value={draft.customer.fullName || "-"} />
        <SummaryRow label={messages.bookingFlow.summary.attendees} value={String(draft.partySize)} />
        <SummaryRow label={messages.bookingFlow.summary.deposit} value={formatCurrency(service.deposit)} />
        <SummaryRow label={messages.bookingFlow.summary.total} value={formatCurrency(service.price)} />
      </Card>
    </div>
  );
}

function BookingSidebar({
  messages,
  locale,
  service,
  selectedEmployeeName,
  draft
}: {
  messages: Messages;
  locale: string;
  service: Service;
  selectedEmployeeName: string | null;
  draft: BookingDraft;
}) {
  return (
    <Card className="h-fit lg:sticky lg:top-6">
      <p className="text-sm font-semibold uppercase text-muted">{messages.bookingFlow.steps.summary}</p>
      <h2 className="mt-2 text-2xl font-bold text-primary">{service.name}</h2>
      <div className="mt-5 grid gap-4 text-sm">
        <SidebarItem icon={<FiClock />} label={messages.services.duration} value={`${service.durationMinutes} ${messages.services.minutes}`} />
        <SidebarItem icon={<FiShield />} label={messages.services.price} value={formatCurrency(service.price)} />
        <SidebarItem icon={<FiUser />} label={messages.bookingFlow.summary.employee} value={selectedEmployeeName ?? "-"} />
        <SidebarItem
          icon={<FiMapPin />}
          label={messages.bookingFlow.summary.date}
          value={draft.selectedSlot ? formatLongDate(draft.selectedSlot.date, locale) : "-"}
        />
      </div>
    </Card>
  );
}

function SuccessState({
  messages,
  locale,
  service,
  draft,
  employeeName
}: {
  messages: Messages;
  locale: string;
  service: Service;
  draft: BookingDraft;
  employeeName: string;
}) {
  return (
    <Card className="mx-auto max-w-2xl text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
        <FiCheckCircle className="text-3xl" aria-hidden="true" />
      </div>
      <h1 className="mt-5 text-3xl font-bold text-primary">{messages.bookingFlow.successTitle}</h1>
      <p className="mt-3 text-sm leading-6 text-muted">{messages.bookingFlow.successDescription}</p>
      <div className="mt-6 rounded-2xl border border-subtle bg-input p-5 text-left">
        <SummaryRow label={messages.bookingFlow.summary.service} value={service.name} />
        <SummaryRow label={messages.bookingFlow.summary.employee} value={employeeName} />
        <SummaryRow
          label={messages.bookingFlow.summary.date}
          value={draft.selectedSlot ? formatLongDate(draft.selectedSlot.date, locale) : "-"}
        />
        <SummaryRow
          label={messages.bookingFlow.summary.time}
          value={draft.selectedSlot ? `${draft.selectedSlot.startTime} - ${draft.selectedSlot.endTime}` : "-"}
        />
      </div>
      <div className="mt-6 flex justify-center">
        <Link href={`/reservar/${service.id}`} className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-subtle bg-surface px-4 text-sm font-semibold text-primary transition-colors hover:bg-surface-strong">
          {messages.actions.reserveAnother}
        </Link>
      </div>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-subtle pb-3 last:border-b-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold text-primary">{value}</span>
    </div>
  );
}

function SidebarItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-brand-strong">{icon}</span>
      <div>
        <p className="text-xs font-bold uppercase text-muted">{label}</p>
        <p className="mt-1 font-semibold text-primary">{value}</p>
      </div>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-subtle bg-input p-4">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-2 text-base font-semibold text-primary">{value}</p>
    </div>
  );
}

function StateCard({ title, description }: { title: string; description?: string }) {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <h1 className="text-2xl font-bold text-primary">{title}</h1>
      {description ? <p className="mt-3 text-sm leading-6 text-muted">{description}</p> : null}
    </Card>
  );
}

function getStepValidationMessage(step: typeof stepOrder[number], draft: BookingDraft, messages: Messages) {
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
}
