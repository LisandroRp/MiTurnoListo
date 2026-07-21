import { ChangeEvent, ReactNode, useRef, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCheck, FiEdit2, FiInfo, FiPlus, FiTrash2 } from "react-icons/fi";

import { SectionHeader } from "@/components/composed/SectionHeader";
import { StepProgress } from "@/components/composed/StepProgress";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import { AvailabilityEditor, dayKeys } from "@/features/scheduling/components/AvailabilityEditor";
import { employeeColorClasses } from "@/features/scheduling/components/employeeColors";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Employee, ServiceSchedule, TimeRange } from "@/features/scheduling/types";
import { createNewEmployeeDraft } from "@/lib/networking/endpoints/scheduling";

type PersonnelViewProps = {
  messages: Messages;
  employees: Employee[];
  onSaveEmployee: (employee: Employee) => Promise<boolean>;
  onDeleteEmployee: (employeeId: string) => Promise<boolean>;
  onValidationWarning: () => void;
  onImageUploadError: (message: string) => void;
};

type PersonnelMode = "grid" | "form";
type PersonnelWizardStep = "details" | "schedule" | "review";

const personnelWizardStepOrder: PersonnelWizardStep[] = ["details", "schedule", "review"];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "NA";
}

export function PersonnelView({
  messages,
  employees,
  onSaveEmployee,
  onDeleteEmployee,
  onValidationWarning,
  onImageUploadError
}: PersonnelViewProps) {
  const rangeIdCounter = useRef(1);
  const [mode, setMode] = useState<PersonnelMode>("grid");
  const [draft, setDraft] = useState<Employee>(() => createNewEmployeeDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const currentStep = personnelWizardStepOrder[currentStepIndex] ?? "details";
  const stepItems = personnelWizardStepOrder.map((step) => ({
    id: step,
    label: messages.personnel.steps[step]
  }));

  function startCreate() {
    setDraft(createNewEmployeeDraft());
    setEditingId(null);
    setCurrentStepIndex(0);
    setValidationMessage(null);
    setMode("form");
  }

  function startEdit(employee: Employee) {
    setDraft({ ...employee, schedule: structuredClone(employee.schedule) });
    setEditingId(employee.id);
    setCurrentStepIndex(0);
    setValidationMessage(null);
    setMode("form");
  }

  function returnToGrid() {
    setMode("grid");
    setEditingId(null);
    setCurrentStepIndex(0);
    setValidationMessage(null);
  }

  function handleTextChange(field: keyof Employee) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setDraft((current) => ({
        ...current,
        [field]: value,
        initials: field === "name" ? getInitials(value) : current.initials
      }));
    };
  }

  function addRange(day: keyof ServiceSchedule) {
    const range: TimeRange = { id: `${day}-${rangeIdCounter.current}`, start: "09:00", end: "10:00" };
    rangeIdCounter.current += 1;
    setDraft((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        [day]: [...current.schedule[day], range]
      }
    }));
  }

  function updateRange(day: keyof ServiceSchedule, rangeId: string, field: keyof TimeRange, value: string) {
    setDraft((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        [day]: current.schedule[day].map((range) => (
          range.id === rangeId ? { ...range, [field]: value } : range
        ))
      }
    }));
  }

  function removeRange(day: keyof ServiceSchedule, rangeId: string) {
    setDraft((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        [day]: current.schedule[day].filter((range) => range.id !== rangeId)
      }
    }));
  }

  function goToStep(index: number) {
    setCurrentStepIndex(index);
    setValidationMessage(null);
  }

  function goToPreviousStep() {
    setCurrentStepIndex((current) => Math.max(current - 1, 0));
    setValidationMessage(null);
  }

  function goToNextStep() {
    const stepValidationMessage = getPersonnelStepValidationMessage(currentStep, draft, messages);

    if (stepValidationMessage) {
      setValidationMessage(stepValidationMessage);
      onValidationWarning();
      return;
    }

    setValidationMessage(null);
    setCurrentStepIndex((current) => Math.min(current + 1, personnelWizardStepOrder.length - 1));
  }

  async function submitForm() {
    const invalidStepIndex = personnelWizardStepOrder.findIndex((step) => getPersonnelStepValidationMessage(step, draft, messages));

    if (invalidStepIndex >= 0) {
      const invalidStep = personnelWizardStepOrder[invalidStepIndex] ?? "details";
      setCurrentStepIndex(invalidStepIndex);
      setValidationMessage(getPersonnelStepValidationMessage(invalidStep, draft, messages));
      onValidationWarning();
      return;
    }

    const didSave = await onSaveEmployee({ ...draft, initials: getInitials(draft.name) });

    if (didSave) {
      returnToGrid();
    }
  }

  if (mode === "form") {
    return (
      <div className="grid gap-6">
        <SectionHeader
          eyebrow={messages.personnel.eyebrow}
          title={editingId ? messages.personnel.formTitleEdit : messages.personnel.formTitleCreate}
          description={messages.personnel.requiredHint}
          actions={
            <Button variant="secondary" onClick={returnToGrid}>{messages.actions.cancel}</Button>
          }
        />

        <StepProgress steps={stepItems} currentStepIndex={currentStepIndex} onStepSelect={goToStep} />

        <WizardActions
          className="flex"
          currentStep={currentStep}
          currentStepIndex={currentStepIndex}
          messages={messages}
          onCancel={returnToGrid}
          onPrevious={goToPreviousStep}
          onNext={goToNextStep}
          onSubmit={submitForm}
        />

        {validationMessage ? (
          <div className="rounded-lg border border-danger bg-danger-soft p-4 text-sm font-semibold text-danger">
            {validationMessage}
          </div>
        ) : null}

        <div className="grid gap-5">
          {currentStep === "details" ? (
            <FormSection title={messages.personnel.detailsSection} description={messages.personnel.detailsSectionHint}>
            <div className="grid gap-4 lg:grid-cols-2">
              <TextField label={messages.personnel.name} value={draft.name} onChange={handleTextChange("name")} />
              <TextField label={messages.personnel.role} value={draft.role} onChange={handleTextChange("role")} />
              <ImageUploadField
                label={messages.personnel.imageUrl}
                value={draft.imageUrl}
                onChange={(value) => setDraft((current) => ({ ...current, imageUrl: value }))}
                onError={onImageUploadError}
                chooseLabel={messages.actions.uploadImage}
                replaceLabel={messages.actions.replaceImage}
                removeLabel={messages.actions.removeImage}
                requirementsLabel={messages.personnel.imageRequirements}
                helperText={messages.personnel.imageUploadHint}
                className="lg:col-span-2"
              />
            </div>
            <TextAreaField label={messages.personnel.descriptionLabel} value={draft.description} onChange={handleTextChange("description")} />
            </FormSection>
          ) : null}

          {currentStep === "schedule" ? (
            <FormSection title={messages.personnel.scheduleSection} description={messages.personnel.scheduleSectionHint}>
            <AvailabilityEditor
              messages={messages}
              schedule={draft.schedule}
              onAddRange={addRange}
              onUpdateRange={updateRange}
              onRemoveRange={removeRange}
            />
            </FormSection>
          ) : null}

          {currentStep === "review" ? (
            <PersonnelReview
              messages={messages}
              employee={{ ...draft, initials: getInitials(draft.name) }}
            />
          ) : null}
        </div>

        <WizardActions
          className="flex"
          currentStep={currentStep}
          currentStepIndex={currentStepIndex}
          messages={messages}
          onCancel={returnToGrid}
          onPrevious={goToPreviousStep}
          onNext={goToNextStep}
          onSubmit={submitForm}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow={messages.personnel.eyebrow}
        title={messages.personnel.title}
        description={messages.personnel.description}
        actions={
          <Button icon={<FiPlus />} onClick={startCreate}>
            {messages.actions.addEmployee}
          </Button>
        }
      />

      <Card className="flex items-start gap-3 bg-brand-soft">
        <FiInfo className="mt-1 shrink-0 text-brand-strong" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold text-primary">{messages.personnel.disclaimerTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{messages.personnel.disclaimerDescription}</p>
        </div>
      </Card>

      <section className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {employees.length > 0 ? employees.map((employee) => (
          <Card
            key={employee.id}
            className="flex h-full w-full flex-col overflow-hidden p-0 transition duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand hover:shadow-lg"
          >
            <div
              className="h-36 bg-surface-strong bg-cover bg-center"
              style={{ backgroundImage: employee.imageUrl ? `url(${employee.imageUrl})` : undefined }}
            />
            <div className="flex flex-1 flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-on-brand", employeeColorClasses[employee.color])}>
                  {employee.initials}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-primary">{employee.name}</h2>
                  <p className="text-sm text-muted">{employee.role}</p>
                </div>
              </div>

              <p className="line-clamp-3 text-sm leading-6 text-muted">{employee.description}</p>

              <div className="mt-auto grid gap-2 border-t border-subtle pt-4">
                <Button className="w-full" variant="secondary" size="sm" icon={<FiEdit2 />} onClick={() => startEdit(employee)}>
                  {messages.actions.edit}
                </Button>
                <Button className="w-full" variant="danger" size="sm" icon={<FiTrash2 />} onClick={() => void onDeleteEmployee(employee.id)}>
                  {messages.actions.delete}
                </Button>
              </div>
            </div>
          </Card>
        )) : (
          <Card className="h-fit">
            <p className="text-sm text-muted">{messages.personnel.empty}</p>
          </Card>
        )}
      </section>
    </div>
  );
}

function WizardActions({
  className,
  currentStep,
  currentStepIndex,
  messages,
  onCancel,
  onPrevious,
  onNext,
  onSubmit
}: {
  className?: string;
  currentStep: PersonnelWizardStep;
  currentStepIndex: number;
  messages: Messages;
  onCancel: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className={cx("flex-row gap-3 sm:justify-between", className)}>
      {currentStepIndex > 0 ? (
        <Button className="w-1/2 sm:w-auto" variant="secondary" icon={<FiArrowLeft />} onClick={onPrevious}>
          {messages.actions.back}
        </Button>
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

function PersonnelReview({ messages, employee }: { messages: Messages; employee: Employee }) {
  const scheduleRangeCount = getScheduleRangeCount(employee.schedule);

  return (
    <FormSection title={messages.personnel.reviewSection} description={messages.personnel.reviewSectionHint}>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div
          className="min-h-56 rounded-lg bg-surface-strong bg-cover bg-center"
          style={{ backgroundImage: employee.imageUrl ? `url(${employee.imageUrl})` : undefined }}
        />
        <div className="grid content-start gap-4">
          <div className="flex items-start gap-3">
            <span className={cx("grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold text-on-brand", employeeColorClasses[employee.color])}>
              {employee.initials}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold text-primary">{employee.name || messages.personnel.untitledEmployee}</h2>
              <p className="mt-1 text-sm font-semibold text-muted">{employee.role || messages.personnel.emptyRole}</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted">{employee.description || messages.personnel.emptyDescription}</p>
          <ServiceFact label={messages.personnel.schedule} value={`${scheduleRangeCount} ${messages.personnel.ranges}`} />
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-bold text-primary">{messages.personnel.schedule}</h3>
        {scheduleRangeCount > 0 ? (
          <div className="grid gap-2">
            {dayKeys.map((day) => {
              const ranges = employee.schedule[day] ?? [];

              if (ranges.length === 0) {
                return null;
              }

              return (
                <div key={day} className="rounded-lg border border-subtle bg-input p-3">
                  <p className="text-sm font-semibold text-primary">{messages.days[day]}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ranges.map((range) => (
                      <span key={range.id} className="rounded-lg border border-subtle bg-surface px-3 py-1 text-sm font-semibold text-primary">
                        {range.start} - {range.end}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-subtle bg-input p-3 text-sm text-muted">{messages.personnel.emptySchedule}</p>
        )}
      </div>
    </FormSection>
  );
}

function ServiceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-input p-3 text-sm">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold text-primary">{value}</dd>
    </div>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="grid gap-5">
      <div className="border-b border-subtle pb-4">
        <h2 className="text-lg font-bold text-primary">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </Card>
  );
}

function getPersonnelStepValidationMessage(step: PersonnelWizardStep, employee: Employee, messages: Messages) {
  if (step === "details" && (!employee.name.trim() || !employee.role.trim())) {
    return messages.personnel.validation.details;
  }

  return null;
}

function getScheduleRangeCount(schedule: ServiceSchedule) {
  return Object.values(schedule).reduce((total, ranges) => total + ranges.length, 0);
}
