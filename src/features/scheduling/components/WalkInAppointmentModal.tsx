"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { FiClock, FiMail, FiPhone, FiPlusCircle, FiUser, FiX } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { BookingCustomerSuggestion } from "@/features/booking-flow/types";
import { Appointment, Employee, PaymentMethod, Service } from "@/features/scheduling/types";
import { Messages } from "@/features/scheduling/i18n/messages";
import { formatCurrency } from "@/features/scheduling/utils/format";
import { getCustomers } from "@/lib/networking/endpoints/customers";

type WalkInAppointmentModalProps = {
  businessId: string | null;
  employees: Employee[];
  isOpen: boolean;
  messages: Messages;
  services: Service[];
  onClose: () => void;
  onCreateAppointment: (appointment: Appointment) => Promise<boolean> | void;
};

const walkInCustomerName = "Sobreturno";

export function WalkInAppointmentModal({
  businessId,
  employees,
  isOpen,
  messages,
  services,
  onClose,
  onCreateAppointment
}: WalkInAppointmentModalProps) {
  const availableServices = useMemo(() => services.filter((service) => (
    !service.isArchived &&
    service.isVisible &&
    service.employeeIds.some((employeeId) => employees.some((employee) => isReservableEmployee(employee) && employee.id === employeeId))
  )), [employees, services]);
  const [serviceId, setServiceId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [shouldAddCustomerDetails, setShouldAddCustomerDetails] = useState(false);
  const [customer, setCustomer] = useState({ fullName: "", phone: "", email: "" });
  const [customerLookupQuery, setCustomerLookupQuery] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState<BookingCustomerSuggestion[]>([]);
  const [isLoadingCustomerSuggestions, setIsLoadingCustomerSuggestions] = useState(false);
  const [activeLookupField, setActiveLookupField] = useState<"fullName" | "email" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const selectedService = availableServices.find((service) => service.id === serviceId) ?? null;
  const availableEmployees = selectedService
    ? employees.filter((employee) => isReservableEmployee(employee) && selectedService.employeeIds.includes(employee.id))
    : [];
  const selectedEmployee = availableEmployees.find((employee) => employee.id === employeeId) ?? null;
  const hasValidCustomerDetails = (
    customer.fullName.trim().length > 0 &&
    customer.phone.trim().length > 0 &&
    isValidEmail(customer.email)
  );
  const canSave = Boolean(selectedService && selectedEmployee && (!shouldAddCustomerDetails || hasValidCustomerDetails));
  const shouldShowAppointmentFields = availableServices.length > 0;

  useEffect(() => {
    const normalizedQuery = customerLookupQuery.trim();

    if (!isOpen || !shouldAddCustomerDetails || !businessId || normalizedQuery.length < 1) {
      setCustomerSuggestions([]);
      setIsLoadingCustomerSuggestions(false);
      return;
    }

    let isActive = true;
    setIsLoadingCustomerSuggestions(true);

    const timeoutId = window.setTimeout(() => {
      void getCustomers(businessId, { page: 1, perPage: 5, search: normalizedQuery })
        .then((response) => {
          if (!isActive) {
            return;
          }

          setCustomerSuggestions(response.data.map((item) => ({
            id: item.id,
            fullName: item.fullName,
            email: item.email,
            phone: item.phone
          })));
        })
        .catch(() => {
          if (isActive) {
            setCustomerSuggestions([]);
          }
        })
        .finally(() => {
          if (isActive) {
            setIsLoadingCustomerSuggestions(false);
          }
        });
    }, 1500);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [businessId, customerLookupQuery, isOpen, shouldAddCustomerDetails]);

  function closeModal() {
    if (isSaving) {
      return;
    }

    setServiceId("");
    setEmployeeId("");
    resetCustomerDetails();
    onClose();
  }

  async function saveWalkInAppointment() {
    if (!selectedService || !selectedEmployee || !canSave) {
      return;
    }

    setIsSaving(true);

    try {
      const start = new Date();
      const end = new Date(start.getTime() + selectedService.durationMinutes * 60 * 1000);
      const didCreate = await onCreateAppointment({
        id: globalThis.crypto.randomUUID(),
        customerName: shouldAddCustomerDetails ? customer.fullName.trim() : walkInCustomerName,
        customerEmail: shouldAddCustomerDetails ? customer.email.trim() : "",
        customerPhone: shouldAddCustomerDetails ? customer.phone.trim() : "",
        serviceId: selectedService.id,
        employeeId: selectedEmployee.id,
        date: formatDateInputValue(start),
        startTime: formatTimeInputValue(start),
        endTime: formatTimeInputValue(end),
        status: "confirmed",
        appointmentStatus: "scheduled",
        paymentStatus: "paid",
        source: "walk_in",
        revenue: selectedService.price,
        paymentMethod: normalizeWalkInPaymentMethod(selectedService.paymentMethod),
        partySize: 1
      });

      if (didCreate !== false) {
        setServiceId("");
        setEmployeeId("");
        resetCustomerDetails();
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen}>
      <div className="grid gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{messages.walkInAppointment.eyebrow}</p>
            <h2 className="mt-1 text-2xl font-bold text-primary">{messages.walkInAppointment.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{messages.walkInAppointment.description}</p>
          </div>
          <Button
            aria-label={messages.actions.closeMenu}
            icon={<FiX />}
            size="icon"
            variant="ghost"
            onClick={closeModal}
          />
        </div>

        {shouldShowAppointmentFields ? (
          <div className="grid gap-4">
            <SelectField
              label={messages.walkInAppointment.serviceLabel}
              value={serviceId}
              options={[
                { value: "", label: messages.walkInAppointment.servicePlaceholder },
                ...availableServices.map((service) => ({ value: service.id, label: service.name }))
              ]}
              onChange={(event) => {
                setServiceId(event.target.value);
                setEmployeeId("");
              }}
            />

            <div className={!selectedService ? "opacity-60" : ""}>
              <SelectField
                label={messages.walkInAppointment.employeeLabel}
                value={employeeId}
                disabled={!selectedService}
                className={!selectedService ? "cursor-not-allowed bg-surface-strong text-muted" : ""}
                options={[
                  { value: "", label: messages.walkInAppointment.employeePlaceholder },
                  ...availableEmployees.map((employee) => ({ value: employee.id, label: employee.name }))
                ]}
                onChange={(event) => setEmployeeId(event.target.value)}
              />
            </div>

            <CheckboxField
              label={messages.walkInAppointment.addCustomerDetails}
              helperText={messages.walkInAppointment.addCustomerDetailsHint}
              checked={shouldAddCustomerDetails}
              className="border-0 bg-transparent !p-0"
              onChange={(event) => {
                setShouldAddCustomerDetails(event.target.checked);

                if (!event.target.checked) {
                  resetCustomerDetails();
                }
              }}
            />

            {shouldAddCustomerDetails ? (
              <div className="grid gap-4 rounded-lg border border-subtle bg-input p-3 lg:grid-cols-2">
                <CustomerLookupField
                  isOpen={activeLookupField === "fullName" && (customer.fullName.trim().length > 0) && (customerSuggestions.length > 0 || isLoadingCustomerSuggestions)}
                  isLoading={isLoadingCustomerSuggestions}
                  label={messages.bookingFlow.customerName}
                  messages={messages}
                  prefix={<FiUser />}
                  suggestions={customerSuggestions}
                  value={customer.fullName}
                  onBlur={() => setActiveLookupField(null)}
                  onChange={(value) => {
                    setCustomer((current) => ({ ...current, fullName: value }));
                    setCustomerLookupQuery(value);
                  }}
                  onFocus={() => {
                    setActiveLookupField("fullName");
                    setCustomerLookupQuery(customer.fullName);
                  }}
                  onSelect={selectCustomerSuggestion}
                />
                <TextField
                  label={messages.bookingFlow.customerPhone}
                  value={customer.phone}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  prefix={<FiPhone />}
                  required
                  onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value.replace(/\D/g, "") }))}
                />
                <div className="lg:col-span-2">
                  <CustomerLookupField
                    isOpen={activeLookupField === "email" && (customer.email.trim().length > 0) && (customerSuggestions.length > 0 || isLoadingCustomerSuggestions)}
                    isLoading={isLoadingCustomerSuggestions}
                    label={messages.bookingFlow.customerEmail}
                    messages={messages}
                    prefix={<FiMail />}
                    suggestions={customerSuggestions}
                    type="email"
                    value={customer.email}
                    onBlur={() => setActiveLookupField(null)}
                    onChange={(value) => {
                      setCustomer((current) => ({ ...current, email: value }));
                      setCustomerLookupQuery(value);
                    }}
                    onFocus={() => {
                      setActiveLookupField("email");
                      setCustomerLookupQuery(customer.email);
                    }}
                    onSelect={selectCustomerSuggestion}
                  />
                </div>
              </div>
            ) : null}

            {selectedService ? (
              <div className="grid gap-2 rounded-lg border border-subtle bg-input p-3 text-sm">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <FiClock className="text-brand-strong" aria-hidden="true" />
                  <span>{messages.walkInAppointment.nowLabel}</span>
                </div>
                <p className="text-muted">
                  {messages.walkInAppointment.summary
                    .replace("{duration}", `${selectedService.durationMinutes} ${messages.services.minutes}`)
                    .replace("{price}", formatCurrency(selectedService.price))}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-subtle bg-input p-4 text-sm font-semibold text-muted">
            {messages.walkInAppointment.emptyState}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={closeModal}>
            {messages.actions.cancel}
          </Button>
          <Button
            icon={<FiPlusCircle />}
            isLoading={isSaving}
            disabled={!canSave}
            onClick={() => void saveWalkInAppointment()}
          >
            {messages.walkInAppointment.saveAction}
          </Button>
        </div>
      </div>
    </Modal>
  );

  function resetCustomerDetails() {
    setShouldAddCustomerDetails(false);
    setCustomer({ fullName: "", phone: "", email: "" });
    setCustomerLookupQuery("");
    setCustomerSuggestions([]);
    setIsLoadingCustomerSuggestions(false);
    setActiveLookupField(null);
  }

  function selectCustomerSuggestion(customerSuggestion: BookingCustomerSuggestion) {
    setCustomer({
      fullName: customerSuggestion.fullName,
      email: customerSuggestion.email,
      phone: customerSuggestion.phone
    });
    setCustomerLookupQuery("");
    setCustomerSuggestions([]);
    setActiveLookupField(null);
  }
}

function CustomerLookupField({
  isOpen,
  isLoading,
  label,
  messages,
  prefix,
  suggestions,
  type = "text",
  value,
  onBlur,
  onChange,
  onFocus,
  onSelect
}: {
  isOpen: boolean;
  isLoading: boolean;
  label: string;
  messages: Messages;
  prefix: ReactNode;
  suggestions: BookingCustomerSuggestion[];
  type?: "email" | "text";
  value: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  onFocus: () => void;
  onSelect: (customerSuggestion: BookingCustomerSuggestion) => void;
}) {
  return (
    <div className="relative">
      <TextField
        label={label}
        type={type}
        value={value}
        prefix={prefix}
        required
        onBlur={onBlur}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
      />

      {isOpen ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border border-subtle bg-surface shadow-lg">
          {isLoading ? (
            <p className="px-3 py-2 text-sm font-semibold text-muted">{messages.bookingFlow.customerLookupLoading}</p>
          ) : (
            <div className="max-h-60 overflow-y-auto py-1">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="grid w-full cursor-pointer gap-1 px-3 py-2 text-left transition-colors hover:bg-brand-soft focus:bg-brand-soft focus:outline-none"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(suggestion)}
                >
                  <span className="text-sm font-bold text-primary">{suggestion.fullName}</span>
                  <span className="text-xs text-muted">
                    {[suggestion.email, suggestion.phone].filter(Boolean).join(" - ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function isReservableEmployee(employee: Employee) {
  return !employee.isArchived && employee.isVisible;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeWalkInPaymentMethod(paymentMethod: PaymentMethod): PaymentMethod {
  return paymentMethod === "mixed" ? "cash" : paymentMethod;
}

function formatDateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatTimeInputValue(date: Date) {
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0")
  ].join(":");
}
