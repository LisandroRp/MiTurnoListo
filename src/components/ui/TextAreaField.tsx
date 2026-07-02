import { TextareaHTMLAttributes } from "react";

import { cx } from "@/components/ui/utils";

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export function TextAreaField({ label, className, id, ...props }: TextAreaFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="grid gap-2 text-sm font-medium text-primary" htmlFor={fieldId}>
      {label}
      <textarea
        {...props}
        id={fieldId}
        className={cx(
          "min-h-24 w-full resize-y rounded-lg border border-subtle bg-input px-3 py-3 text-sm text-primary outline-none transition-colors",
          "placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-focus",
          className
        )}
      />
    </label>
  );
}
