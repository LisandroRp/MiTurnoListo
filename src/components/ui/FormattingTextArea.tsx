"use client";

import { useId, useRef } from "react";
import { FiBold, FiList, FiUnderline } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { applyTextFormat, TextFormat } from "@/components/ui/text-format";

type FormattingTextAreaProps = {
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  helperText?: string;
  labels: Record<TextFormat, string>;
  onChange: (value: string) => void;
};

export function FormattingTextArea({ label, value, placeholder, labels, maxLength, helperText, onChange }: FormattingTextAreaProps) {
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  function formatText(format: TextFormat) {
    const element = field.current;
    if (!element) return;
    const formatted = applyTextFormat(value, element.selectionStart, element.selectionEnd, format);
    if (maxLength !== undefined && formatted.value.length > maxLength && formatted.value.length >= value.length) return;
    onChange(formatted.value);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(formatted.start, formatted.end);
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-primary">{label}</label>
        <div role="group" aria-label={label} className="flex gap-0.5 rounded-lg border border-subtle bg-surface p-0.5">
          {([
            ["bold", FiBold], ["underline", FiUnderline], ["list", FiList]
          ] as const).map(([format, Icon]) => (
            <Button
              key={format}
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sm text-brand-strong"
              aria-label={labels[format]}
              title={labels[format]}
              aria-controls={id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => formatText(format)}
            >
              <Icon aria-hidden="true" />
            </Button>
          ))}
        </div>
      </div>
      <TextAreaField
        id={id}
        ref={field}
        label=""
        value={value}
        maxLength={maxLength}
        helperText={helperText}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />

    </div>
  );
}
