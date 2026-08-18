import { FiArrowLeft, FiArrowRight, FiCheck } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/utils";
import { Messages } from "@/features/scheduling/i18n/messages";

import { PersonnelWizardStep } from "./types";

type WizardActionsProps = {
  className?: string;
  currentStep: PersonnelWizardStep;
  currentStepIndex: number;
  messages: Messages;
  onCancel: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
};

export function WizardActions({
  className,
  currentStep,
  currentStepIndex,
  messages,
  onCancel,
  onPrevious,
  onNext,
  onSubmit
}: WizardActionsProps) {
  return (
    <div className={cx("flex-row gap-3 sm:justify-between", className)}>
      {currentStepIndex > 0 ? (
        <div className="grid w-1/2 grid-cols-2 gap-3 sm:w-auto sm:flex">
          <Button className="w-full sm:w-auto" variant="secondary" onClick={onCancel}>
            {messages.actions.cancel}
          </Button>
          <Button className="w-full sm:w-auto" variant="secondary" icon={<FiArrowLeft />} onClick={onPrevious}>
            {messages.actions.back}
          </Button>
        </div>
      ) : (
        <Button className="w-1/2 sm:w-auto" variant="secondary" onClick={onCancel}>
          {messages.actions.cancel}
        </Button>
      )}

      {currentStep === "review" ? (
        <Button className="w-1/2 sm:w-auto" icon={<FiCheck />} onClick={onSubmit}>
          {messages.actions.save}
        </Button>
      ) : (
        <Button className="w-1/2 sm:w-auto" icon={<FiArrowRight />} onClick={onNext}>
          {messages.actions.continue}
        </Button>
      )}
    </div>
  );
}
