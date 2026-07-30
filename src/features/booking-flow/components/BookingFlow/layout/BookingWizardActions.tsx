import { Button } from "@/components/ui/Button";

export function BookingWizardActions({
  backLabel,
  currentStepIndex,
  isSubmitDisabled,
  isSubmitting,
  submitLabel,
  onNext,
  onPrevious
}: {
  backLabel: string;
  currentStepIndex: number;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  submitLabel: string;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
      {currentStepIndex > 0 ? (
        <Button variant="secondary" onClick={onPrevious}>
          {backLabel}
        </Button>
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
