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
  onSelectedFileChange?: (file: File | null) => void;
};

const defaultAcceptedTypes = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
const defaultAcceptedExtensions = [".heic", ".heif"];

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
  accept = "image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif",
  maxSizeInMb = 5,
  onSelectedFileChange
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
    onSelectedFileChange?.(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!isAcceptedImageFile(file)) {
      onError(`Formatos permitidos: PNG, JPG, WEBP, HEIC o HEIF.`);
      event.target.value = "";
      return;
    }

    if (file.size > maxSizeInMb * 1024 * 1024) {
      onError(`La imagen debe pesar menos de ${maxSizeInMb} MB.`);
      event.target.value = "";
      return;
    }

    setIsReading(true);

    try {
      const result = await readFileAsDataUrl(file);
      onChange(result);
      onSelectedFileChange?.(file);
    } catch (error) {
      onError(error instanceof Error ? error.message : "No pudimos procesar la imagen. Intenta con otro archivo.");
    } finally {
      setIsReading(false);
      event.target.value = "";
    }
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
                  className="h-full w-full bg-contain bg-center bg-no-repeat"
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

function isAcceptedImageFile(file: File) {
  const normalizedName = file.name.toLowerCase();

  return (
    defaultAcceptedTypes.includes(file.type) ||
    defaultAcceptedExtensions.some((extension) => normalizedName.endsWith(extension))
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };

    reader.onerror = () => {
      reject(new Error("No pudimos leer la imagen. Intenta con otro archivo."));
    };

    reader.readAsDataURL(file);
  });
}
