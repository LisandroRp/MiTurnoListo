import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FiEdit2, FiPlus, FiUsers } from "react-icons/fi";

import { PlanLimitIndicator } from "@/features/scheduling/components/PlanLimitIndicator";
import { PlanLimitModal } from "@/components/composed/PlanLimitModal";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { StepProgress } from "@/components/composed/StepProgress";
import { DualActionSlot } from "@/components/composed/DualActionSlot";
import { useDualActionVisibility } from "@/components/composed/useDualActionVisibility";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PointerTiltCard } from "@/components/ui/PointerTiltCard";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import { AvailabilityEditor, maxRangesPerDay } from "@/features/scheduling/components/AvailabilityEditor";
import { EmployeeAvatar } from "@/features/scheduling/components/PersonnelView/EmployeeAvatar";
import { EmployeeStat, ServiceBadges, WeekdayPills, WeeklyOccupationBar } from "@/features/scheduling/components/PersonnelView/EmployeeCardParts";
import { EmployeeActionsMenu, EmployeeVisibilitySwitch } from "@/features/scheduling/components/PersonnelView/EmployeeControls";
import { FormSection } from "@/features/scheduling/components/PersonnelView/FormSection";
import { PersonnelReview } from "@/features/scheduling/components/PersonnelView/PersonnelReview";
import { PersonnelFilters } from "@/features/scheduling/components/PersonnelView/PersonnelFilters";
import { formatTodayRanges, getDayKeyForDate, getInitials, getPersonnelStepValidationMessage, getWeeklyOccupation } from "@/features/scheduling/components/PersonnelView/personnelViewUtils";
import { EmployeeMenuAction, PersonnelFilter, PersonnelMode, PersonnelWizardStep } from "@/features/scheduling/components/PersonnelView/types";
import { WizardActions } from "@/features/scheduling/components/PersonnelView/WizardActions";
import { Messages } from "@/features/scheduling/i18n/messages";
import { hasVisibleResourceSlot, getVisibleResourceLimit, getPlanIncludedIds } from "@/features/scheduling/plan-limits";
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
  startsInCreateMode?: boolean;
  onLeaveSetupCreation?: () => void;
  onSaveEmployee: (employee: Employee) => Promise<boolean>;
  onArchiveEmployee: (employeeId: string) => Promise<boolean>;
  onDeleteEmployee: (employeeId: string) => Promise<boolean>;
  onUnarchiveEmployee: (employeeId: string) => Promise<boolean>;
  onUpdateEmployeeVisibility: (employeeId: string, isVisible: boolean) => Promise<boolean>;
  onValidationWarning: () => void;
  onImageUploadError: (message: string) => void;
};

const personnelWizardStepOrder: PersonnelWizardStep[] = ["details", "schedule", "review"];

export function PersonnelView({
  messages,
  employees,
  services,
  appointments,
  businessId,
  referenceDate,
  subscriptionTier,
  startsInCreateMode = false,
  onLeaveSetupCreation,
  onSaveEmployee,
  onArchiveEmployee,
  onDeleteEmployee,
  onUnarchiveEmployee,
  onUpdateEmployeeVisibility,
  onValidationWarning,
  onImageUploadError
}: PersonnelViewProps) {
  const searchParams = useSearchParams();
  const employeeSearchParam = searchParams.get("search") ?? "";
  const rangeIdCounter = useRef(1);
  const hasVisibleSlot = hasVisibleResourceSlot(employees, subscriptionTier, "employees");
  const [mode, setMode] = useState<PersonnelMode>(startsInCreateMode ? "form" : "grid");
  const [draft, setDraft] = useState<Employee>(() => ({ ...createNewEmployeeDraft(employees), isVisible: hasVisibleSlot }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [pendingEmployeeImageFile, setPendingEmployeeImageFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState(employeeSearchParam);
  const [personnelFilter, setPersonnelFilter] = useState<PersonnelFilter>("all");
  const [showArchivedPersonnel, setShowArchivedPersonnel] = useState(false);
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [lockedEmployee, setLockedEmployee] = useState<Employee | null>(null);
  const [pendingMenuAction, setPendingMenuAction] = useState<{ employeeId: string; action: EmployeeMenuAction } | null>(null);

  const includedVisibleIds = getPlanIncludedIds(employees.filter((employee) => !employee.isArchived && employee.isVisible), subscriptionTier, "employees");
  const currentStep = personnelWizardStepOrder[currentStepIndex] ?? "details";
  const stepItems = personnelWizardStepOrder.map((step) => ({
    id: step,
    label: messages.personnel.steps[step]
  }));
  const todayKey = getDayKeyForDate(referenceDate);
  const wizardActionVisibility = useDualActionVisibility();
  useEffect(() => {
    setSearchTerm(employeeSearchParam);
  }, [employeeSearchParam]);

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesFilter =
      showArchivedPersonnel
        ? employee.isArchived
        : personnelFilter === "all"
          ? !employee.isArchived
          : !employee.isArchived && (personnelFilter === "visible" ? employee.isVisible : !employee.isVisible);

    return matchesSearch && matchesFilter;
  }).sort((left, right) => Number(left.isArchived) - Number(right.isArchived) || left.name.localeCompare(right.name));

  function startCreate() {
    setDraft({ ...createNewEmployeeDraft(employees), isVisible: hasVisibleSlot });
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
    if (isSavingEmployee) {
      return;
    }

    resetForm();
  }

  function resetForm() {
    setMode("grid");
    setEditingId(null);
    setCurrentStepIndex(0);
    setPendingEmployeeImageFile(null);
    setValidationMessage(null);
    onLeaveSetupCreation?.();
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
        [day]: current.schedule[day].length >= maxRangesPerDay
          ? current.schedule[day]
          : [...current.schedule[day], range]
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
    if (isSavingEmployee) {
      return;
    }

    if (index !== currentStepIndex) {
      const stepValidationMessage = getPersonnelStepValidationMessage(currentStep, draft, messages);

      if (stepValidationMessage) {
        setValidationMessage(stepValidationMessage);
        onValidationWarning();
        return;
      }
    }

    setCurrentStepIndex(index);
    setValidationMessage(null);
  }

  function goToPreviousStep() {
    if (isSavingEmployee) {
      return;
    }

    setCurrentStepIndex((current) => Math.max(current - 1, 0));
    setValidationMessage(null);
  }

  function goToNextStep() {
    if (isSavingEmployee) {
      return;
    }

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
    if (isSavingEmployee) {
      return;
    }

    const invalidStepIndex = personnelWizardStepOrder.findIndex((step) => getPersonnelStepValidationMessage(step, draft, messages));

    if (invalidStepIndex >= 0) {
      const invalidStep = personnelWizardStepOrder[invalidStepIndex] ?? "details";
      setCurrentStepIndex(invalidStepIndex);
      setValidationMessage(getPersonnelStepValidationMessage(invalidStep, draft, messages));
      onValidationWarning();
      return;
    }

    setIsSavingEmployee(true);

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
      const didSave = await onSaveEmployee({ ...employeeToSave, isVisible: employeeToSave.isVisible && hasVisibleResourceSlot(employees, subscriptionTier, "employees", employeeToSave.id), initials: getInitials(employeeToSave.name) });

      if (didSave) {
        resetForm();
      }
    } catch (error) {
      onImageUploadError(error instanceof Error ? error.message : "No pudimos subir la foto del profesional.");
    } finally {
      setIsSavingEmployee(false);
    }
  }

  async function runEmployeeMenuAction(employeeId: string, action: EmployeeMenuAction, callback: () => Promise<boolean>) {
    if (pendingMenuAction) {
      return;
    }

    setPendingMenuAction({ employeeId, action });

    try {
      await callback();
    } finally {
      setPendingMenuAction(null);
    }
  }

  async function toggleEmployeeVisibility(employee: Employee) {
    if (!employee.isVisible && !hasVisibleResourceSlot(employees, subscriptionTier, "employees", employee.id)) {
      setLockedEmployee(employee);
      return;
    }
    await runEmployeeMenuAction(
      employee.id,
      "visibility",
      () => onUpdateEmployeeVisibility(employee.id, !employee.isVisible)
    );
  }

  if (mode === "form") {
    return (
      <div className="grid gap-6">
        <SectionHeader
          icon={<FiUsers />}
          eyebrow={messages.personnel.eyebrow}
          title={editingId ? messages.personnel.formTitleEdit : messages.personnel.formTitleCreate}
          description={messages.personnel.requiredHint}
          actions={
            <Button variant="secondary" disabled={isSavingEmployee} onClick={returnToGrid}>{messages.actions.cancel}</Button>
          }
        />

        <StepProgress
          steps={stepItems}
          currentStepIndex={currentStepIndex}
          maxSelectableStepIndex={editingId ? stepItems.length - 1 : currentStepIndex}
          onStepSelect={goToStep}
        />

        <DualActionSlot ref={wizardActionVisibility.topRef} isVisible={wizardActionVisibility.showTopActions}>
          <WizardActions
            className="flex"
            currentStep={currentStep}
            currentStepIndex={currentStepIndex}
            isSaving={isSavingEmployee}
            messages={messages}
            onCancel={returnToGrid}
            onPrevious={goToPreviousStep}
            onNext={goToNextStep}
            onSubmit={submitForm}
          />
        </DualActionSlot>

        {validationMessage ? (
          <div className="rounded-lg border border-danger bg-danger-soft p-4 text-sm font-semibold text-danger">
            {validationMessage}
          </div>
        ) : null}

        {!editingId && !hasVisibleSlot ? <p className="text-sm text-muted">{messages.planLimits.newResourceHiddenHint}</p> : null}
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

        <DualActionSlot ref={wizardActionVisibility.bottomRef} isVisible={wizardActionVisibility.showBottomActions}>
          <WizardActions
            className="flex"
            currentStep={currentStep}
            currentStepIndex={currentStepIndex}
            isSaving={isSavingEmployee}
            messages={messages}
            onCancel={returnToGrid}
            onPrevious={goToPreviousStep}
            onNext={goToNextStep}
            onSubmit={submitForm}
          />
        </DualActionSlot>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <SectionHeader
        icon={<FiUsers />}
        eyebrow={messages.personnel.eyebrow}
        title={messages.personnel.title}
        description={messages.personnel.description}
        actions={
          <Button icon={<FiPlus />} onClick={startCreate}>
            {messages.actions.addEmployee}
          </Button>
        }
      />

      <PersonnelFilters
        filter={personnelFilter}
        messages={messages}
        searchTerm={searchTerm}
        showArchived={showArchivedPersonnel}
        onArchivedToggle={() => {
          if (showArchivedPersonnel) {
            setPersonnelFilter("all");
          }

          setShowArchivedPersonnel((current) => !current);
        }}
        onFilterChange={(filter) => {
          setShowArchivedPersonnel(false);
          setPersonnelFilter(filter);
        }}
        onSearchChange={setSearchTerm}
      />

      <section className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredEmployees.length > 0 ? filteredEmployees.map((employee) => {
          const isArchived = employee.isArchived;
          const isOutsidePlan = !isArchived && employee.isVisible && includedVisibleIds !== null && !includedVisibleIds.has(employee.id);
          const employeeServices = services.filter((service) => !service.isArchived && service.employeeIds.includes(employee.id));
          const todayRanges = employee.schedule[todayKey] ?? [];
          const todayAppointments = appointments.filter((appointment) => (
            appointment.employeeId === employee.id &&
            appointment.date === referenceDate &&
            appointment.appointmentStatus !== "cancelled"
          ));
          const weeklyOccupation = getWeeklyOccupation(employee, employeeServices, appointments, referenceDate);
          const visibilitySwitch = (
                  !isArchived ? (
                    <EmployeeVisibilitySwitch
                      employee={employee}
                      isDisabled={pendingMenuAction !== null}
                      isLoading={pendingMenuAction?.employeeId === employee.id && pendingMenuAction.action === "visibility"}
                      messages={messages}
                      onToggle={() => void toggleEmployeeVisibility(employee)}
                    />
                  ) : null
          );
          const visibilityControls = (
                <div className={cx("grid shrink-0 justify-items-end gap-2", isOutsidePlan && "absolute right-5 top-5 z-20")}>
                  <EmployeeActionsMenu
                    disabled={pendingMenuAction !== null}
                    employee={employee}
                    loadingAction={pendingMenuAction?.employeeId === employee.id ? pendingMenuAction.action : null}
                    messages={messages}
                    onArchive={() => runEmployeeMenuAction(employee.id, "archive", () => onArchiveEmployee(employee.id))}
                    onDelete={() => runEmployeeMenuAction(employee.id, "delete", () => onDeleteEmployee(employee.id))}
                    onUnarchive={() => runEmployeeMenuAction(employee.id, "unarchive", () => onUnarchiveEmployee(employee.id))}
                  />
                  {visibilitySwitch}
                </div>
          );

          return (
          <PointerTiltCard
            intensity={50}
            key={employee.id}
            className={cx(
              "relative flex h-full min-h-[22rem] w-full flex-col hover:border-brand",
              isArchived && "bg-shell/70 opacity-60 grayscale",
            )}
          >
            <div className={cx("flex h-full flex-col gap-4", isOutsidePlan && "opacity-50 grayscale blur-[2px]")} inert={isOutsidePlan} aria-hidden={isOutsidePlan}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <EmployeeAvatar employee={employee} />
                  <div className="min-w-0 pt-1">
                    <h2 className="truncate text-base font-bold text-primary">{employee.name}</h2>
                    <p className="truncate text-sm text-muted">{employee.role || messages.personnel.emptyRole}</p>
                  </div>
                </div>
                {isOutsidePlan ? <div className="h-16 w-24 shrink-0" aria-hidden="true" /> : visibilityControls}
              </div>

              <div className="grid gap-2 text-sm">
                <EmployeeStat label={messages.personnel.todaySchedule} value={formatTodayRanges(todayRanges)} />
                <EmployeeStat label={messages.personnel.todayAppointments} value={String(todayAppointments.length)} />
                <WeeklyOccupationBar label={messages.personnel.weeklyOccupation} value={weeklyOccupation} />
              </div>

              <ServiceBadges messages={messages} services={employeeServices} />

              <div className="mt-auto grid justify-items-center gap-3 pt-2">
                <WeekdayPills employee={employee} messages={messages} />
                <Button className="w-full" variant="secondary" size="sm" icon={<FiEdit2 />} disabled={isArchived || isOutsidePlan} onClick={() => startEdit(employee)}>
                  {messages.personnel.editProfile}
                </Button>
              </div>
            </div>
            {isOutsidePlan ? (
              <>
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-surface/40 p-5" role="group" aria-label={employee.name}>
                  <div className="pointer-events-auto">
                    <PlanLimitIndicator label={messages.planLimits.lockedCardHint} onClick={() => setLockedEmployee(employee)} />
                  </div>
                </div>
                {visibilityControls}
              </>
            ) : null}
          </PointerTiltCard>
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
        title={messages.planLimits.visibilityEmployeeTitle}
        description={messages.planLimits.visibilityEmployeeDescription.replace("{plan}", subscriptionTier.toUpperCase()).replace("{limit}", String(getVisibleResourceLimit(subscriptionTier, "employees")))}
        actionLabel={messages.planLimits.infinityAction}
        onClose={() => setLockedEmployee(null)}
      />

    </div>
  );
}
