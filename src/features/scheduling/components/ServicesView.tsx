import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { FiArrowLeft, FiArrowRight, FiCheck, FiCopy, FiEdit2, FiInfo, FiLink, FiPlus, FiShare2, FiTrash2, FiX } from "react-icons/fi";

import { SectionHeader } from "@/components/composed/SectionHeader";
import { StepProgress } from "@/components/composed/StepProgress";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { SelectField } from "@/components/ui/SelectField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import { AvailabilityEditor, dayKeys } from "@/features/scheduling/components/AvailabilityEditor";
import { employeeColorClasses } from "@/features/scheduling/components/employeeColors";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Employee, PaymentMethod, Service, ServiceSchedule, TimeRange } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";
import { createNewServiceDraft } from "@/lib/networking/endpoints/scheduling";

type ServicesViewProps = {
  messages: Messages;
  services: Service[];
  employees: Employee[];
  onSaveService: (service: Service) => Promise<boolean>;
  onDeleteService: (serviceId: string) => Promise<boolean>;
  onValidationWarning: () => void;
  onImageUploadError: (message: string) => void;
  onShareSuccess: () => void;
  onShareError: () => void;
};

type ServicesMode = "grid" | "form";
type ServiceWizardStep = "details" | "booking" | "staff" | "schedule" | "review";

const paymentMethods: PaymentMethod[] = ["cash", "card", "transfer", "mixed"];
const serviceWizardStepOrder: ServiceWizardStep[] = ["details", "booking", "staff", "schedule", "review"];

export function ServicesView({
  messages,
  services,
  employees,
  onSaveService,
  onDeleteService,
  onValidationWarning,
  onImageUploadError,
  onShareSuccess,
  onShareError
}: ServicesViewProps) {
  const rangeIdCounter = useRef(1);
  const [mode, setMode] = useState<ServicesMode>("grid");
  const [draft, setDraft] = useState<Service>(() => createNewServiceDraft(employees.map((employee) => employee.id)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [savingVisibilityId, setSavingVisibilityId] = useState<string | null>(null);
  const [sharingService, setSharingService] = useState<Service | null>(null);

  const currentStep = serviceWizardStepOrder[currentStepIndex] ?? "details";
  const stepItems = serviceWizardStepOrder.map((step) => ({
    id: step,
    label: messages.services.steps[step]
  }));

  function startCreate() {
    setDraft(createNewServiceDraft(employees.map((employee) => employee.id)));
    setEditingId(null);
    setCurrentStepIndex(0);
    setValidationMessage(null);
    setMode("form");
  }

  function startEdit(service: Service) {
    setDraft({ ...service, schedule: structuredClone(service.schedule), employeeIds: [...service.employeeIds] });
    setEditingId(service.id);
    setCurrentStepIndex(0);
    setValidationMessage(null);
    setMode("form");
  }

  function startDuplicate(service: Service) {
    setDraft({
      ...service,
      id: globalThis.crypto.randomUUID(),
      name: `${service.name} ${messages.services.copySuffix}`,
      schedule: structuredClone(service.schedule),
      employeeIds: [...service.employeeIds]
    });
    setEditingId(null);
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

  function handleTextChange(field: keyof Service) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setDraft((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  function handleNumericTextChange(field: keyof Service) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setDraft((current) => ({ ...current, [field]: parseNumericInput(event.target.value) }));
    };
  }

  function handleVisibilityChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft((current) => ({ ...current, isVisible: event.target.checked }));
  }

  function toggleAssignedEmployee(employeeId: string) {
    setDraft((current) => ({
      ...current,
      employeeIds: current.employeeIds.includes(employeeId)
        ? current.employeeIds.filter((id) => id !== employeeId)
        : [...current.employeeIds, employeeId]
    }));
  }

  async function toggleServiceVisibility(service: Service) {
    if (savingVisibilityId) {
      return;
    }

    setSavingVisibilityId(service.id);

    await onSaveService({
      ...service,
      schedule: structuredClone(service.schedule),
      employeeIds: [...service.employeeIds],
      isVisible: !service.isVisible
    });

    setSavingVisibilityId(null);
  }

  async function copyServiceLink(service: Service) {
    if (!service.isVisible) {
      return;
    }

    try {
      await navigator.clipboard.writeText(getPublicServiceUrl(service.id));
      onShareSuccess();
    } catch {
      onShareError();
    }
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
    const stepValidationMessage = getServiceStepValidationMessage(currentStep, draft, messages);

    if (stepValidationMessage) {
      setValidationMessage(stepValidationMessage);
      onValidationWarning();
      return;
    }

    setValidationMessage(null);
    setCurrentStepIndex((current) => Math.min(current + 1, serviceWizardStepOrder.length - 1));
  }

  async function submitForm() {
    const invalidStepIndex = serviceWizardStepOrder.findIndex((step) => getServiceStepValidationMessage(step, draft, messages));

    if (invalidStepIndex >= 0) {
      const invalidStep = serviceWizardStepOrder[invalidStepIndex] ?? "details";
      setCurrentStepIndex(invalidStepIndex);
      setValidationMessage(getServiceStepValidationMessage(invalidStep, draft, messages));
      onValidationWarning();
      return;
    }

    const didSave = await onSaveService(draft);

    if (didSave) {
      returnToGrid();
    }
  }

  if (mode === "form") {
    return (
      <div className="grid gap-6">
        <SectionHeader
          eyebrow={messages.services.eyebrow}
          title={editingId ? messages.services.formTitleEdit : messages.services.formTitleCreate}
          description={messages.services.formDisclaimer}
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
            <FormSection title={messages.services.detailsSection} description={messages.services.detailsSectionHint}>
            <div className="grid items-start gap-4">
              <TextField label={messages.services.name} value={draft.name} onChange={handleTextChange("name")} />
              <ImageUploadField
                label={messages.services.imageUrl}
                value={draft.imageUrl}
                onChange={(value) => setDraft((current) => ({ ...current, imageUrl: value }))}
                onError={onImageUploadError}
                chooseLabel={messages.actions.uploadImage}
                replaceLabel={messages.actions.replaceImage}
                removeLabel={messages.actions.removeImage}
                requirementsLabel={messages.services.imageRequirements}
                helperText={messages.services.imageUploadHint}
              />
            </div>
            <TextAreaField label={messages.services.descriptionLabel} value={draft.description} onChange={handleTextChange("description")} />
            <CheckboxField
              label={messages.services.visible}
              checked={draft.isVisible}
              onChange={handleVisibilityChange}
            />
            </FormSection>
          ) : null}

          {currentStep === "booking" ? (
            <FormSection title={messages.services.bookingSection} description={messages.services.bookingSectionHint}>
            <div className="grid gap-4 lg:grid-cols-3">
              <TextField label={messages.services.price} inputMode="numeric" pattern="[0-9]*" value={formatNumericInputValue(draft.price, true)} onChange={handleNumericTextChange("price")} />
              <TextField label={messages.services.duration} inputMode="numeric" pattern="[0-9]*" value={formatNumericInputValue(draft.durationMinutes)} onChange={handleNumericTextChange("durationMinutes")} />
              <TextField label={messages.services.capacity} inputMode="numeric" pattern="[0-9]*" value={formatNumericInputValue(draft.capacity)} onChange={handleNumericTextChange("capacity")} />
              <TextField label={messages.services.deposit} inputMode="numeric" pattern="[0-9]*" value={formatNumericInputValue(draft.deposit, true)} onChange={handleNumericTextChange("deposit")} />
              <TextField label={messages.services.leadTime} inputMode="numeric" pattern="[0-9]*" value={formatNumericInputValue(draft.reservationLeadMinutes)} onChange={handleNumericTextChange("reservationLeadMinutes")} />
              <SelectField
                label={messages.services.paymentMethod}
                value={draft.paymentMethod}
                onChange={handleTextChange("paymentMethod")}
                options={paymentMethods.map((method) => ({ value: method, label: messages.paymentMethods[method] }))}
              />
            </div>
            </FormSection>
          ) : null}

          {currentStep === "staff" ? (
            <FormSection title={messages.services.staffSection} description={messages.services.staffSectionHint}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {employees.map((employee) => {
                const isSelected = draft.employeeIds.includes(employee.id);

                return (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => toggleAssignedEmployee(employee.id)}
                    className={cx(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                      isSelected ? "border-brand bg-brand-soft" : "border-subtle bg-input hover:bg-surface-strong"
                    )}
                  >
                    <span className={cx("h-3 w-3 rounded-full", employeeColorClasses[employee.color])} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-primary">{employee.name}</span>
                      <span className="block truncate text-xs text-muted">{employee.role}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            </FormSection>
          ) : null}

          {currentStep === "schedule" ? (
            <FormSection title={messages.services.scheduleSection} description={messages.services.scheduleSectionHint}>
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
            <ServiceReview
              messages={messages}
              service={draft}
              employees={employees}
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
        eyebrow={messages.services.eyebrow}
        title={messages.services.title}
        description={messages.services.description}
        actions={
          <Button icon={<FiPlus />} onClick={startCreate}>
            {messages.actions.addService}
          </Button>
        }
      />

      <Card className="flex items-start gap-3 bg-brand-soft">
        <FiInfo className="mt-1 shrink-0 text-brand-strong" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold text-primary">{messages.services.disclaimerTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{messages.services.disclaimerDescription}</p>
        </div>
      </Card>

      <section className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {services.length > 0 ? services.map((service) => (
          <Card
            key={service.id}
            className="flex h-full w-full flex-col overflow-hidden p-0 transition duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand hover:shadow-lg"
          >
            <div
              className="h-36 bg-surface-strong bg-cover bg-center"
              style={{ backgroundImage: service.imageUrl ? `url(${service.imageUrl})` : undefined }}
            />
            <div className="flex flex-1 flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-primary">{service.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{service.description}</p>
                </div>
                <VisibilitySwitch
                  messages={messages}
                  isVisible={service.isVisible}
                  isLoading={savingVisibilityId === service.id}
                  onToggle={() => void toggleServiceVisibility(service)}
                />
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <ServiceFact label={messages.services.price} value={formatCurrency(service.price)} />
                <ServiceFact label={messages.services.duration} value={`${service.durationMinutes} ${messages.services.minutes}`} />
                <ServiceFact label={messages.services.capacity} value={`${service.capacity} ${messages.services.people}`} />
                <ServiceFact label={messages.services.deposit} value={formatCurrency(service.deposit)} />
              </dl>

              <div className="mt-auto grid gap-2 border-t border-subtle pt-4">
                <Button
                  className="w-full"
                  variant="secondary"
                  size="sm"
                  icon={<FiShare2 />}
                  disabled={!service.isVisible}
                  title={!service.isVisible ? messages.services.shareHiddenHint : messages.actions.share}
                  onClick={() => setSharingService(service)}
                >
                  {messages.actions.share}
                </Button>
                <Button className="w-full" variant="secondary" size="sm" icon={<FiEdit2 />} onClick={() => startEdit(service)}>
                  {messages.actions.edit}
                </Button>
                <Button className="w-full" variant="secondary" size="sm" icon={<FiCopy />} onClick={() => startDuplicate(service)}>
                  {messages.actions.duplicate}
                </Button>
                <Button className="w-full" variant="danger" size="sm" icon={<FiTrash2 />} onClick={() => void onDeleteService(service.id)}>
                  {messages.actions.delete}
                </Button>
              </div>
            </div>
          </Card>
        )) : (
          <Card className="h-fit">
            <p className="text-sm text-muted">{messages.services.empty}</p>
          </Card>
        )}
      </section>

      {sharingService ? (
        <ShareServiceModal
          key={sharingService.id}
          messages={messages}
          service={sharingService}
          serviceUrl={getPublicServiceUrl(sharingService.id)}
          onClose={() => setSharingService(null)}
          onCopy={() => void copyServiceLink(sharingService)}
        />
      ) : null}
    </div>
  );
}

function ShareServiceModal({
  messages,
  service,
  serviceUrl,
  onClose,
  onCopy
}: {
  messages: Messages;
  service: Service;
  serviceUrl: string;
  onClose: () => void;
  onCopy: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let isActive = true;

    void QRCode.toDataURL(serviceUrl, {
      margin: 2,
      width: 260
    }).then((dataUrl) => {
      if (isActive) {
        setQrDataUrl(dataUrl);
      }
    });

    return () => {
      isActive = false;
    };
  }, [serviceUrl]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-primary/35 p-4">
      <Card className="grid w-fit max-w-full gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-muted">{messages.actions.share}</p>
            <h2 className="mt-1 text-2xl font-bold text-primary">{messages.services.shareTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {messages.services.shareDescription.replace("{serviceName}", service.name)}
            </p>
          </div>
          <Button size="icon" variant="ghost" aria-label={messages.actions.cancel} onClick={onClose}>
            <FiX />
          </Button>
        </div>

        <div className="grid justify-items-center gap-4 rounded-xl border border-subtle bg-input p-5">
          {qrDataUrl ? (
            <Image
              src={qrDataUrl}
              alt={messages.services.shareQrAlt}
              width={260}
              height={260}
              unoptimized
              className="h-64 w-64 rounded-lg border border-subtle bg-surface p-3"
            />
          ) : (
            <div className="grid h-64 w-64 place-items-center rounded-lg border border-subtle bg-surface text-sm text-muted">
              {messages.services.generatingQr}
            </div>
          )}
          <div className="flex w-full items-center gap-2 rounded-lg border border-subtle bg-surface px-3 py-2 text-sm text-muted">
            <FiLink className="shrink-0" aria-hidden="true" />
            <span className="truncate">{serviceUrl}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            {messages.actions.cancel}
          </Button>
          <Button icon={<FiCopy />} onClick={onCopy}>
            {messages.services.copyPublicLink}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function getPublicServiceUrl(serviceId: string) {
  return `${window.location.origin}/reservar/${serviceId}`;
}

function ServiceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-input p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold text-primary">{value}</dd>
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
  currentStep: ServiceWizardStep;
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

function VisibilitySwitch({
  messages,
  isVisible,
  isLoading,
  onToggle
}: {
  messages: Messages;
  isVisible: boolean;
  isLoading: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isVisible}
      disabled={isLoading}
      aria-busy={isLoading}
      onClick={onToggle}
      className={cx(
        "inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-2.5 text-xs font-bold transition-all",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:cursor-not-allowed disabled:opacity-55",
        isVisible ? "border-success bg-success-soft text-success" : "border-subtle bg-input text-muted",
        isLoading ? "animate-pulse" : ""
      )}
    >
      <span
        className={cx(
          "relative h-4 w-8 rounded-full transition-colors",
          isVisible ? "bg-success" : "bg-muted"
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-3 w-3 rounded-full bg-surface transition-transform",
            isVisible ? "-translate-x-3.5" : "translate-x-0.5"
          )}
        />
      </span>
      <span className="min-w-12 text-left">
        {isLoading ? messages.services.savingVisibility : isVisible ? messages.services.visible : messages.services.hidden}
      </span>
    </button>
  );
}

function ServiceReview({ messages, service, employees }: { messages: Messages; service: Service; employees: Employee[] }) {
  const assignedEmployees = employees.filter((employee) => service.employeeIds.includes(employee.id));
  const scheduleRangeCount = getScheduleRangeCount(service.schedule);

  return (
    <FormSection title={messages.services.reviewSection} description={messages.services.reviewSectionHint}>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div
          className="min-h-56 rounded-lg bg-surface-strong bg-cover bg-center"
          style={{ backgroundImage: service.imageUrl ? `url(${service.imageUrl})` : undefined }}
        />
        <div className="grid gap-4">
          <div>
            <Badge tone={service.isVisible ? "success" : "neutral"}>
              {service.isVisible ? messages.services.visible : messages.services.hidden}
            </Badge>
            <h2 className="mt-3 text-2xl font-bold text-primary">{service.name || messages.services.untitledService}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{service.description || messages.services.emptyDescription}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <ServiceFact label={messages.services.price} value={formatCurrency(service.price)} />
            <ServiceFact label={messages.services.duration} value={`${service.durationMinutes} ${messages.services.minutes}`} />
            <ServiceFact label={messages.services.capacity} value={`${service.capacity} ${messages.services.people}`} />
            <ServiceFact label={messages.services.deposit} value={formatCurrency(service.deposit)} />
            <ServiceFact label={messages.services.paymentMethod} value={messages.paymentMethods[service.paymentMethod]} />
            <ServiceFact label={messages.services.schedule} value={`${scheduleRangeCount} ${messages.services.ranges}`} />
          </dl>
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-bold text-primary">{messages.services.assignedStaff}</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {assignedEmployees.map((employee) => (
            <div key={employee.id} className="flex items-center gap-3 rounded-lg border border-subtle bg-input p-3">
              <span className={cx("h-3 w-3 rounded-full", employeeColorClasses[employee.color])} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-primary">{employee.name}</span>
                <span className="block truncate text-xs text-muted">{employee.role}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-bold text-primary">{messages.services.schedule}</h3>
        {scheduleRangeCount > 0 ? (
          <div className="grid gap-2">
            {dayKeys.map((day) => {
              const ranges = service.schedule[day] ?? [];

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
          <p className="rounded-lg border border-subtle bg-input p-3 text-sm text-muted">{messages.services.emptySchedule}</p>
        )}
      </div>
    </FormSection>
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

function getServiceStepValidationMessage(step: ServiceWizardStep, service: Service, messages: Messages) {
  if (step === "details" && !service.name.trim()) {
    return messages.services.validation.details;
  }

  if (step === "booking" && (service.price <= 0 || service.durationMinutes <= 0 || service.capacity <= 0 || service.deposit < 0 || service.reservationLeadMinutes < 0)) {
    return messages.services.validation.booking;
  }

  if (step === "staff" && service.employeeIds.length === 0) {
    return messages.services.validation.staff;
  }

  return null;
}

function getScheduleRangeCount(schedule: ServiceSchedule) {
  return Object.values(schedule).reduce((total, ranges) => total + ranges.length, 0);
}

function formatNumericInputValue(value: number, hideZero = false) {
  return hideZero && value === 0 ? "" : String(value);
}

function parseNumericInput(value: string) {
  const digits = value.replace(/\D/g, "");

  return digits ? Number(digits) : 0;
}
