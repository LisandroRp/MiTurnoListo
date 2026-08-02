import { Button } from "@/components/ui/Button";

export function BookingWizardActions({
  backLabel,
  cancelLabel,
  currentStepIndex,
  isSubmitDisabled,
  isSubmitting,
  submitLabel,
  onCancel,
  onNext,
  onPrevious
}: {
  backLabel: string;
  cancelLabel: string;
  currentStepIndex: number;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  submitLabel: string;
  onCancel: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
      {currentStepIndex > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Button variant="secondary" disabled={isSubmitting} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="secondary" disabled={isSubmitting} onClick={onPrevious}>
            {backLabel}
          </Button>
        </div>
      ) : (
        <span />
      )}

      <Button
        isLoading={isSubmitting}
        disabled={isSubmitDisabled}
        onClick={onNext}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
