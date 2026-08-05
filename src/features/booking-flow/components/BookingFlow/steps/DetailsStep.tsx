import { useState } from "react";
import { FiMail, FiPhone, FiUser } from "react-icons/fi";

import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import { ReceiptWhatsappNotice, TransferPaymentRow } from "@/features/booking-flow/components/BookingFlow/shared/TransferReceipt";
import { buildReceiptWhatsappMessage, buildWhatsAppHref } from "@/features/booking-flow/components/BookingFlow/utils/bookingFlowUtils";
import { BookingDraft, BookingPaymentOption } from "@/features/booking-flow/types";
import { Messages } from "@/features/scheduling/i18n/messages";
import { BusinessPaymentSettings, Service } from "@/features/scheduling/types";

export function DetailsStep({
  messages,
  locale,
  service,
  availablePaymentOptions,
  selectedPaymentOption,
  customer,
  draft,
  paymentSettingsText,
  onPaymentOptionChange,
  onMissingCustomerName,
  onCustomerChange
}: {
  messages: Messages;
  locale: string;
  service: Service;
  availablePaymentOptions: BookingPaymentOption[];
  selectedPaymentOption: BookingPaymentOption | null;
  customer: BookingDraft["customer"];
  draft: BookingDraft;
  paymentSettingsText: BusinessPaymentSettings["transfers"];
  onPaymentOptionChange: (option: BookingPaymentOption) => void;
  onMissingCustomerName: () => void;
  onCustomerChange: (field: keyof BookingDraft["customer"], value: string) => void;
}) {
  const [copiedField, setCopiedField] = useState<"cbu" | "alias" | null>(null);

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
          <div className="rounded-2xl border border-brand bg-brand-soft p-4 shadow-sm">
            <h3 className="text-base font-bold text-primary">{messages.bookingFlow.businessPaymentInfo}</h3>
            <div className="mt-3 grid gap-3 text-sm">
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
          <TextField
            label={messages.bookingFlow.customerName}
            value={customer.fullName}
            prefix={<FiUser />}
            required
            onChange={(event) => onCustomerChange("fullName", event.target.value)}
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
            <TextField
              label={messages.bookingFlow.customerEmail}
              type="email"
              value={customer.email}
              prefix={<FiMail />}
              required
              onChange={(event) => onCustomerChange("email", event.target.value)}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
