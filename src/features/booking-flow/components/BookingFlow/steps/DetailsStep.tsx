import { ReactNode, useState } from "react";
import { FiMail, FiPhone, FiUser } from "react-icons/fi";

import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import { ReceiptWhatsappNotice, TransferPaymentRow } from "@/features/booking-flow/components/BookingFlow/shared/TransferReceipt";
import { buildReceiptWhatsappMessage, buildWhatsAppHref } from "@/features/booking-flow/components/BookingFlow/utils/bookingFlowUtils";
import { BookingCustomerSuggestion, BookingDraft, BookingPaymentOption } from "@/features/booking-flow/types";
import { Messages } from "@/features/scheduling/i18n/messages";
import { BusinessPaymentSettings, Service } from "@/features/scheduling/types";

export function DetailsStep({
  messages,
  locale,
  service,
  availablePaymentOptions,
  selectedPaymentOption,
  customer,
  customerSuggestions,
  isLoadingCustomerSuggestions,
  draft,
  paymentSettingsText,
  onPaymentOptionChange,
  onMissingCustomerName,
  onCustomerChange,
  onCustomerLookupQueryChange,
  onCustomerSuggestionSelect
}: {
  messages: Messages;
  locale: string;
  service: Service;
  availablePaymentOptions: BookingPaymentOption[];
  selectedPaymentOption: BookingPaymentOption | null;
  customer: BookingDraft["customer"];
  customerSuggestions: BookingCustomerSuggestion[];
  isLoadingCustomerSuggestions: boolean;
  draft: BookingDraft;
  paymentSettingsText: BusinessPaymentSettings["transfers"];
  onPaymentOptionChange: (option: BookingPaymentOption) => void;
  onMissingCustomerName: () => void;
  onCustomerChange: (field: keyof BookingDraft["customer"], value: string) => void;
  onCustomerLookupQueryChange: (query: string) => void;
  onCustomerSuggestionSelect: (customerSuggestion: BookingCustomerSuggestion) => void;
}) {
  const [copiedField, setCopiedField] = useState<"cbu" | "alias" | null>(null);
  const [activeLookupField, setActiveLookupField] = useState<"fullName" | "email" | null>(null);
  const shouldShowCustomerSuggestions = activeLookupField !== null && (customerSuggestions.length > 0 || isLoadingCustomerSuggestions);

  async function copyTransferValue(field: "cbu" | "alias", value: string) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      setCopiedField(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="grid gap-5">
        <div className="divide-y divide-subtle overflow-hidden rounded-2xl border border-subtle bg-input">
          {availablePaymentOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onPaymentOptionChange(option)}
              className={cx(
                "group flex min-h-11 w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-brand-soft",
                selectedPaymentOption === option && "bg-brand-soft"
              )}
            >
              <span
                className={cx(
                  "grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors group-hover:border-on-brand",
                  selectedPaymentOption === option ? "border-brand-strong" : "border-muted"
                )}
                aria-hidden="true"
              >
                {selectedPaymentOption === option ? <span className="h-2 w-2 rounded-full bg-brand-strong transition-colors group-hover:bg-on-brand" /> : null}
              </span>
              <span className="text-sm font-bold leading-snug text-primary transition-colors group-hover:text-on-brand">{messages.bookingFlow.paymentOptions[option]}</span>
            </button>
          ))}
        </div>

        {selectedPaymentOption === "transfer" ? (
          <div className="rounded-xl border border-brand bg-brand-soft p-3 shadow-sm">
            <h3 className="text-sm font-bold text-primary">{messages.bookingFlow.businessPaymentInfo}</h3>
            <div className="mt-2 grid gap-2 text-sm">
              <TransferPaymentRow
                label={messages.adminPaymentMethods.accountHolder}
                value={paymentSettingsText.accountHolder}
              />
              <TransferPaymentRow
                label={messages.adminPaymentMethods.cbu}
                value={paymentSettingsText.cbu}
                copyLabel={copiedField === "cbu" ? messages.bookingFlow.copied : messages.bookingFlow.copyValue}
                onCopy={() => void copyTransferValue("cbu", paymentSettingsText.cbu)}
              />
              <TransferPaymentRow
                label={messages.adminPaymentMethods.alias}
                value={paymentSettingsText.alias}
                copyLabel={copiedField === "alias" ? messages.bookingFlow.copied : messages.bookingFlow.copyValue}
                onCopy={() => void copyTransferValue("alias", paymentSettingsText.alias)}
              />
              {paymentSettingsText.receiptWhatsapp ? (
                <ReceiptWhatsappNotice
                  messages={messages}
                  href={buildWhatsAppHref(
                    paymentSettingsText.receiptWhatsapp,
                    buildReceiptWhatsappMessage(messages, locale, service, draft)
                  )}
                  onClick={(event) => {
                    if (!customer.fullName.trim()) {
                      event.preventDefault();
                      onMissingCustomerName();
                    }
                  }}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <CustomerLookupField
            isOpen={shouldShowCustomerSuggestions && activeLookupField === "fullName"}
            isLoading={isLoadingCustomerSuggestions}
            label={messages.bookingFlow.customerName}
            messages={messages}
            prefix={<FiUser />}
            suggestions={customerSuggestions}
            value={customer.fullName}
            onBlur={() => setActiveLookupField(null)}
            onChange={(value) => onCustomerChange("fullName", value)}
            onFocus={() => {
              setActiveLookupField("fullName");
              onCustomerLookupQueryChange(customer.fullName);
            }}
            onSelect={onCustomerSuggestionSelect}
          />
          <TextField
            label={messages.bookingFlow.customerPhone}
            value={customer.phone}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            prefix={<FiPhone />}
            required
            onChange={(event) => onCustomerChange("phone", event.target.value.replace(/\D/g, ""))}
          />
          <div className="lg:col-span-2">
            <CustomerLookupField
              isOpen={shouldShowCustomerSuggestions && activeLookupField === "email"}
              isLoading={isLoadingCustomerSuggestions}
              label={messages.bookingFlow.customerEmail}
              messages={messages}
              prefix={<FiMail />}
              suggestions={customerSuggestions}
              type="email"
              value={customer.email}
              onBlur={() => setActiveLookupField(null)}
              onChange={(value) => onCustomerChange("email", value)}
              onFocus={() => {
                setActiveLookupField("email");
                onCustomerLookupQueryChange(customer.email);
              }}
              onSelect={onCustomerSuggestionSelect}
            />
          </div>
        </div>
      </Card>
    </div>
  );
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
