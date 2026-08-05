import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCheck, FiEdit2, FiMoreHorizontal, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";

import { PlanLimitModal } from "@/components/composed/PlanLimitModal";
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
import { freePlanLimits, isFreePlan } from "@/features/scheduling/plan-limits";
import { Appointment, Employee, Service, ServiceSchedule, SubscriptionTier, TimeRange } from "@/features/scheduling/types";
import { createNewEmployeeDraft } from "@/lib/networking/endpoints/scheduling";
import { uploadBusinessImageAsset } from "@/lib/storage/business-assets";

type PersonnelViewProps = {
  messages: Messages;
  employees: Employee[];
  services: Service[];
  appointments: Appointment[];
  businessId: string | null;
  referenceDate: string;
  subscriptionTier: SubscriptionTier;
  onSaveEmployee: (employee: Employee) => Promise<boolean>;
  onDeleteEmployee: (employeeId: string) => Promise<boolean>;
  onValidationWarning: () => void;
  onImageUploadError: (message: string) => void;
};

type PersonnelMode = "grid" | "form";
type PersonnelWizardStep = "details" | "schedule" | "review";
type PersonnelFilter = "all" | "active";

const personnelWizardStepOrder: PersonnelWizardStep[] = ["details", "schedule", "review"];
const visibleServiceBadgeLimit = 3;

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
  services,
  appointments,
  businessId,
  referenceDate,
  subscriptionTier,
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
  const [pendingEmployeeImageFile, setPendingEmployeeImageFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [personnelFilter, setPersonnelFilter] = useState<PersonnelFilter>("all");
  const [lockedEmployee, setLockedEmployee] = useState<Employee | null>(null);

  const currentStep = personnelWizardStepOrder[currentStepIndex] ?? "details";
  const stepItems = personnelWizardStepOrder.map((step) => ({
    id: step,
    label: messages.personnel.steps[step]
  }));
  const unlockedEmployeeIds = new Set(
    isFreePlan(subscriptionTier)
      ? employees.slice(0, freePlanLimits.activeEmployees).map((employee) => employee.id)
      : employees.map((employee) => employee.id)
  );
  const todayKey = getDayKeyForDate(referenceDate);
  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = employee.name.toLowerCase().includes(debouncedSearchTerm.trim().toLowerCase());
    const matchesFilter = personnelFilter === "all" || hasAnySchedule(employee);

    return matchesSearch && matchesFilter;
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  function startCreate() {
    setDraft(createNewEmployeeDraft());
    setEditingId(null);
    setCurrentStepIndex(0);
    setPendingEmployeeImageFile(null);
    setValidationMessage(null);
    setMode("form");
  }

  function startEdit(employee: Employee) {
    setDraft({ ...employee, schedule: structuredClone(employee.schedule) });
    setEditingId(employee.id);
    setCurrentStepIndex(0);
    setPendingEmployeeImageFile(null);
    setValidationMessage(null);
    setMode("form");
  }

  function returnToGrid() {
    setMode("grid");
    setEditingId(null);
    setCurrentStepIndex(0);
    setPendingEmployeeImageFile(null);
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

    try {
      if (pendingEmployeeImageFile && !businessId) {
        throw new Error("No pudimos identificar el negocio para subir la foto.");
      }

      const employeeToSave = pendingEmployeeImageFile && businessId
        ? {
            ...draft,
            imageUrl: await uploadBusinessImageAsset({
              businessId,
              file: pendingEmployeeImageFile,
              path: `${businessId}/employees/${draft.id}.webp`
            })
          }
        : draft;
      const didSave = await onSaveEmployee({ ...employeeToSave, initials: getInitials(employeeToSave.name) });

      if (didSave) {
        returnToGrid();
      }
    } catch (error) {
      onImageUploadError(error instanceof Error ? error.message : "No pudimos subir la foto del profesional.");
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
              <TextField label={messages.personnel.name} value={draft.name} required onChange={handleTextChange("name")} />
              <TextField label={messages.personnel.role} value={draft.role} required onChange={handleTextChange("role")} />
              <ImageUploadField
                label={messages.personnel.imageUrl}
                value={draft.imageUrl}
                onChange={(value) => setDraft((current) => ({ ...current, imageUrl: value }))}
                onSelectedFileChange={setPendingEmployeeImageFile}
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

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative w-full md:max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={messages.personnel.searchPlaceholder}
            className="h-11 w-full rounded-xl border border-subtle bg-input px-4 pl-10 text-sm text-primary shadow-sm outline-none transition placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-focus"
          />
        </label>

        <div className="flex w-fit rounded-xl border border-subtle bg-surface p-1 shadow-sm">
          <button
            type="button"
            className={cx(
              "cursor-pointer rounded-lg px-4 py-2 text-sm font-bold transition-colors",
              personnelFilter === "all" ? "bg-brand text-on-brand" : "text-muted hover:bg-surface-strong hover:text-primary"
            )}
            onClick={() => setPersonnelFilter("all")}
          >
            {messages.personnel.allFilter}
          </button>
          <button
            type="button"
            className={cx(
              "cursor-pointer rounded-lg px-4 py-2 text-sm font-bold transition-colors",
              personnelFilter === "active" ? "bg-brand text-on-brand" : "text-muted hover:bg-surface-strong hover:text-primary"
            )}
            onClick={() => setPersonnelFilter("active")}
          >
            {messages.personnel.activeFilter}
          </button>
        </div>
      </div>

      <section className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredEmployees.length > 0 ? filteredEmployees.map((employee) => {
          const isLockedByPlan = isFreePlan(subscriptionTier) && !unlockedEmployeeIds.has(employee.id);
          const employeeServices = services.filter((service) => service.employeeIds.includes(employee.id));
          const todayRanges = employee.schedule[todayKey] ?? [];
          const todayAppointments = appointments.filter((appointment) => (
            appointment.employeeId === employee.id &&
            appointment.date === referenceDate &&
            appointment.status !== "cancelled"
          ));
          const weeklyOccupation = getWeeklyOccupation(employee, employeeServices, appointments, referenceDate);

          return (
          <Card
            key={employee.id}
            className={cx(
              "relative flex h-full min-h-[22rem] w-full flex-col transition duration-200 hover:-translate-y-1 hover:scale-[1.01] hover:border-brand hover:shadow-lg",
              isLockedByPlan && "hover:translate-y-0 hover:scale-100"
            )}
          >
            <div className={cx("flex h-full flex-col gap-4", isLockedByPlan && "opacity-50 grayscale blur-[1px]")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <EmployeeAvatar employee={employee} />
                  <div className="min-w-0 pt-1">
                    <h2 className="truncate text-base font-bold text-primary">{employee.name}</h2>
                    <p className="truncate text-sm text-muted">{employee.role || messages.personnel.emptyRole}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-start gap-2">
                  <span className="rounded-full bg-brand px-3 py-1 text-xs font-bold text-on-brand">
                    {messages.personnel.active}
                  </span>
                  <EmployeeActionsMenu
                    disabled={isLockedByPlan}
                    messages={messages}
                    onDelete={() => void onDeleteEmployee(employee.id)}
                  />
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <EmployeeStat label={messages.personnel.todaySchedule} value={formatTodayRanges(todayRanges)} />
                <EmployeeStat label={messages.personnel.todayAppointments} value={String(todayAppointments.length)} />
                <WeeklyOccupationBar label={messages.personnel.weeklyOccupation} value={weeklyOccupation} />
              </div>

              <ServiceBadges messages={messages} services={employeeServices} />

              <div className="mt-auto grid justify-items-center gap-3 pt-2">
                <WeekdayPills employee={employee} messages={messages} />
                <Button className="w-full" variant="secondary" size="sm" icon={<FiEdit2 />} disabled={isLockedByPlan} onClick={() => startEdit(employee)}>
                  {messages.personnel.editProfile}
                </Button>
              </div>
            </div>
            {isLockedByPlan ? (
              <button
                type="button"
                className="absolute inset-0 z-10 grid cursor-pointer place-items-center bg-surface/40 p-5 text-center"
                onClick={() => setLockedEmployee(employee)}
              >
                <span className="rounded-full border border-brand bg-surface px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-strong shadow-sm">
                  {messages.planLimits.lockedCardHint}
                </span>
              </button>
            ) : null}
          </Card>
          );
        }) : (
          <Card className="h-fit">
            <p className="text-sm text-muted">{messages.personnel.empty}</p>
          </Card>
        )}
      </section>

      <PlanLimitModal
        isOpen={Boolean(lockedEmployee)}
        badge={messages.planLimits.lockedBadge}
        title={messages.planLimits.lockedEmployeeTitle}
        description={messages.planLimits.lockedEmployeeDescription}
        actionLabel={messages.planLimits.lockedAction}
        onClose={() => setLockedEmployee(null)}
      />
    </div>
  );
}

function EmployeeAvatar({ employee }: { employee: Employee }) {
  return (
    <span className={cx(
      "grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-bold text-on-brand",
      employee.imageUrl ? "bg-surface-strong bg-contain bg-center bg-no-repeat" : employeeColorClasses[employee.color]
    )}
    style={{ backgroundImage: employee.imageUrl ? `url(${employee.imageUrl})` : undefined }}
    >
      {employee.imageUrl ? null : employee.initials}
    </span>
  );
}

function EmployeeActionsMenu({
  disabled,
  messages,
  onDelete
}: {
  disabled: boolean;
  messages: Messages;
  onDelete: () => void;
}) {
  return (
    <details className="group relative">
      <summary
        className={cx(
          "grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-muted transition hover:bg-surface-strong hover:text-primary [&::-webkit-details-marker]:hidden",
          disabled && "pointer-events-none opacity-50"
        )}
        aria-label={messages.actions.openMenu}
      >
        <FiMoreHorizontal aria-hidden="true" />
      </summary>
      <div className="absolute right-0 top-9 z-20 grid min-w-36 overflow-hidden rounded-xl border border-subtle bg-surface p-1 text-sm shadow-lg">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-danger hover:bg-danger-soft"
          onClick={onDelete}
        >
          <FiTrash2 aria-hidden="true" />
          {messages.actions.delete}
        </button>
      </div>
    </details>
  );
}

function WeeklyOccupationBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted">{label}</span>
        <span className="font-bold text-primary">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-shell">
        <div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function EmployeeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-bold text-primary">{value}</span>
    </div>
  );
}

function ServiceBadges({ messages, services }: { messages: Messages; services: Service[] }) {
  const visibleServices = services.slice(0, visibleServiceBadgeLimit);
  const hiddenCount = Math.max(services.length - visibleServiceBadgeLimit, 0);

  if (services.length === 0) {
    return <div className="min-h-14" />;
  }

  return (
    <div className="flex max-h-15 flex-wrap content-start gap-2 overflow-hidden">
      {visibleServices.map((service) => (
        <span key={service.id} className="rounded-full bg-shell px-3 py-1 text-xs font-semibold text-primary">
          {service.name}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="rounded-full bg-shell px-3 py-1 text-xs font-semibold text-primary">
          {messages.personnel.moreServices.replace("{count}", String(hiddenCount))}
        </span>
      ) : null}
    </div>
  );
}

function WeekdayPills({ employee, messages }: { employee: Employee; messages: Messages }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {dayKeys.map((day) => {
        const isAvailable = (employee.schedule[day] ?? []).length > 0;

        return (
          <span
            key={day}
            className={cx(
              "grid h-7 w-7 place-items-center rounded-full text-xs font-bold",
              isAvailable ? "bg-brand text-on-brand" : "bg-shell text-muted"
            )}
            title={messages.days[day]}
          >
            {getShortDayLabel(messages.days[day])}
          </span>
        );
      })}
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

function PersonnelReview({ messages, employee }: { messages: Messages; employee: Employee }) {
  const scheduleRangeCount = getScheduleRangeCount(employee.schedule);

  return (
    <FormSection title={messages.personnel.reviewSection} description={messages.personnel.reviewSectionHint}>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div
          className="min-h-56 rounded-lg bg-surface-strong bg-contain bg-center bg-no-repeat"
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

function hasAnySchedule(employee: Employee) {
  return dayKeys.some((day) => (employee.schedule[day] ?? []).length > 0);
}

function getWeeklyOccupation(
  employee: Employee,
  employeeServices: Service[],
  appointments: Appointment[],
  referenceDate: string
) {
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(referenceDate, index));
  const weeklyAppointments = appointments.filter((appointment) => (
    appointment.employeeId === employee.id &&
    appointment.status !== "cancelled" &&
    weekDates.includes(appointment.date)
  ));
  const estimatedCapacity = weekDates.reduce((total, date) => {
    const ranges = employee.schedule[getDayKeyForDate(date)] ?? [];

    return total + getEstimatedSlotCapacity(ranges, employeeServices);
  }, 0);

  if (estimatedCapacity === 0) {
    return 0;
  }

  return Math.min(100, Math.round((weeklyAppointments.length / estimatedCapacity) * 100));
}

function getEstimatedSlotCapacity(ranges: TimeRange[], services: Service[]) {
  const averageDuration = services.length > 0
    ? services.reduce((total, service) => total + service.durationMinutes, 0) / services.length
    : 60;

  return ranges.reduce((total, range) => {
    const duration = Math.max(getMinutesFromTime(range.end) - getMinutesFromTime(range.start), 0);

    return total + Math.max(Math.floor(duration / averageDuration), 0);
  }, 0);
}

function formatTodayRanges(ranges: TimeRange[]) {
  if (ranges.length === 0) {
    return "-";
  }

  return ranges.map((range) => `${range.start}-${range.end}`).join(", ");
}

function addDays(date: string, days: number) {
  const nextDate = new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate.toISOString().slice(0, 10);
}

function getMinutesFromTime(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");

  return Number(hours) * 60 + Number(minutes);
}

function getDayKeyForDate(date: string) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const dayByWeekday: Record<number, keyof ServiceSchedule> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday"
  };

  return dayByWeekday[weekday] ?? "monday";
}

function getShortDayLabel(label: string) {
  return label.slice(0, 2);
}
