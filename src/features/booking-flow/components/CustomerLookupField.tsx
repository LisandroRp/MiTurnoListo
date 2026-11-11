"use client";

import { type ReactNode, useId, useRef, useState } from "react";
import { TextField } from "@/components/ui/TextField";
import { useDropdownMotion } from "@/components/ui/useDropdownMotion";
import type { BookingCustomerSuggestion } from "@/features/booking-flow/types";
import type { Messages } from "@/features/scheduling/i18n/messages";
import { LoadingDotsText } from "@/features/scheduling/components/LoadingDotsText";

export function CustomerLookupField({
  isOpen,
  isLoading,
  label,
  messages,
  prefix,
  suggestions,
  type = "text",
  disableNativeAutocomplete = false,
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
  disableNativeAutocomplete?: boolean;
  value: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  onFocus: () => void;
  onSelect: (customerSuggestion: BookingCustomerSuggestion) => void;
}) {
  const fieldId = useId();
  const nativeIdentity = disableNativeAutocomplete ? `entry-${fieldId}` : undefined;
  const trigger = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [lastSuggestions, setLastSuggestions] = useState(suggestions);
  const [lastLoading, setLastLoading] = useState(isLoading);
  const { isPresent } = useDropdownMotion({ isOpen, triggerRef: trigger, contentRef: content, variant: "vertical" });
  if (isOpen && lastSuggestions !== suggestions) setLastSuggestions(suggestions);
  if (isOpen && lastLoading !== isLoading) setLastLoading(isLoading);
  if (!isPresent && lastSuggestions.length > 0) setLastSuggestions([]);
  const visibleSuggestions = isOpen ? suggestions : lastSuggestions;
  const visibleLoading = isOpen ? isLoading : lastLoading;
  // Approved nonstandard token to discourage Chromium address autofill in admin entry.
  const nativeAutocomplete = disableNativeAutocomplete ? (type === "email" ? "admin-entry" : "off") : undefined;

  return (
    <div ref={trigger} className="relative">
      <TextField
        id={nativeIdentity}
        name={nativeIdentity}
        label={label}
        type={type}
        inputMode={disableNativeAutocomplete && type === "email" ? "email" : undefined}
        autoComplete={nativeAutocomplete}
        value={value}
        prefix={prefix}
        required
        onBlur={onBlur}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
      />

      {isPresent ? (
        <div ref={content} inert={!isOpen} aria-hidden={!isOpen || undefined} className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border border-subtle bg-surface shadow-lg">
          {visibleLoading ? (
            <p role="status" className="px-3 py-2 text-sm font-semibold text-muted"><LoadingDotsText text={messages.bookingFlow.customerLookupLoading} /></p>
          ) : (
            <div className="max-h-60 overflow-y-auto py-1">
              {visibleSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="grid w-full cursor-pointer gap-1 px-3 py-2 text-left transition-colors hover:bg-brand-soft focus:bg-brand-soft focus:outline-none"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { if (isOpen) onSelect(suggestion); }}
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
