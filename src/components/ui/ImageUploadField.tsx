import { ChangeEvent, useId, useRef, useState } from "react";
import { FiImage, FiTrash2, FiUpload } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/utils";

type ImageUploadFieldProps = {
  label: string;
  helperText?: string;
  value: string;
  onChange: (value: string) => void;
  onError: (message: string) => void;
  chooseLabel: string;
  replaceLabel: string;
  removeLabel: string;
  requirementsLabel: string;
  className?: string;
  accept?: string;
  maxSizeInMb?: number;
};

const defaultAcceptedTypes = ["image/png", "image/jpeg", "image/webp"];

export function ImageUploadField({
  label,
  helperText,
  value,
  onChange,
  onError,
  chooseLabel,
  replaceLabel,
  removeLabel,
  requirementsLabel,
  className,
  accept = "image/png,image/jpeg,image/webp",
  maxSizeInMb = 3
}: ImageUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isReading, setIsReading] = useState(false);
  const hasImage = value.trim().length > 0;

  function openPicker() {
    inputRef.current?.click();
  }

  function clearImage() {
    onChange("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!defaultAcceptedTypes.includes(file.type)) {
      onError(`Formatos permitidos: PNG, JPG o WEBP.`);
      event.target.value = "";
      return;
    }

    if (file.size > maxSizeInMb * 1024 * 1024) {
      onError(`La imagen debe pesar menos de ${maxSizeInMb} MB.`);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    setIsReading(true);

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      onChange(result);
      setIsReading(false);
    };

    reader.onerror = () => {
      onError("No pudimos leer la imagen. Intenta con otro archivo.");
      setIsReading(false);
      event.target.value = "";
    };

    reader.readAsDataURL(file);
  }

  return (
    <div className={cx("grid gap-2", className)}>
      <div className="grid gap-2 text-sm font-medium text-primary">
        <span>{label}</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleFileChange}
        />

        <div className="grid gap-4 rounded-lg border border-dashed border-subtle bg-input p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative h-32 w-full overflow-hidden rounded-lg border border-subtle bg-surface lg:w-40">
              {hasImage ? (
                <div
                  role="img"
                  aria-label={label}
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${value})` }}
                />
              ) : (
                <div className="grid h-full place-items-center text-muted">
                  <FiImage className="text-2xl" aria-hidden="true" />
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <div>
                <p className="text-sm font-semibold text-primary">{requirementsLabel}</p>
                {helperText ? <p className="mt-1 text-xs font-normal text-muted">{helperText}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<FiUpload />}
                  isLoading={isReading}
                  onClick={openPicker}
                >
                  {hasImage ? replaceLabel : chooseLabel}
                </Button>
                {hasImage ? (
                  <Button size="sm" variant="ghost" icon={<FiTrash2 />} onClick={clearImage}>
                    {removeLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
