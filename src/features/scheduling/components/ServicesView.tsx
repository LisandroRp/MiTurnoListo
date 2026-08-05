import { ChangeEvent, ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { FiArrowLeft, FiArrowRight, FiCheck, FiCopy, FiEdit2, FiInfo, FiLink, FiMoreHorizontal, FiPlus, FiSearch, FiShare2, FiTrash2, FiX } from "react-icons/fi";

import { PlanLimitModal } from "@/components/composed/PlanLimitModal";
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
import { freePlanLimits, isFreePlan } from "@/features/scheduling/plan-limits";
import { Appointment, Employee, PaymentMethod, Service, ServiceAddon, ServiceSchedule, SubscriptionTier, TimeRange } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";
import { createNewServiceDraft } from "@/lib/networking/endpoints/scheduling";
import { uploadBusinessImageAsset } from "@/lib/storage/business-assets";

type ServicesViewProps = {
  messages: Messages;
  services: Service[];
  employees: Employee[];
  appointments: Appointment[];
  businessId: string | null;
  subscriptionTier: SubscriptionTier;
  isMercadoPagoConfigured: boolean;
  isTransferConfigured: boolean;
  onSaveService: (service: Service) => Promise<boolean>;
  onDeleteService: (serviceId: string) => Promise<boolean>;
  onValidationWarning: () => void;
  onImageUploadError: (message: string) => void;
  onShareSuccess: () => void;
  onShareError: () => void;
};

type ServicesMode = "grid" | "form";
type ServiceWizardStep = "details" | "booking" | "staff" | "schedule" | "review";
type ServiceStatusFilter = "all" | "visible" | "hidden";

const paymentMethods: PaymentMethod[] = ["cash", "card", "transfer", "mixed"];
const serviceWizardStepOrder: ServiceWizardStep[] = ["details", "booking", "staff", "schedule", "review"];
const visibleServiceEmployeeLimit = 1;

export function ServicesView({
  messages,
  services,
  employees,
  appointments,
  businessId,
  subscriptionTier,
  isMercadoPagoConfigured,
  isTransferConfigured,
  onSaveService,
  onDeleteService,
  onValidationWarning,
  onImageUploadError,
  onShareSuccess,
  onShareError
}: ServicesViewProps) {
  const rangeIdCounter = useRef(1);
  const [mode, setMode] = useState<ServicesMode>("grid");
  const [draft, setDraft] = useState<Service>(() => createNewServiceDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [pendingServiceImageFile, setPendingServiceImageFile] = useState<File | null>(null);
  const [isSavingService, setIsSavingService] = useState(false);
  const [savingVisibilityId, setSavingVisibilityId] = useState<string | null>(null);
  const [sharingService, setSharingService] = useState<Service | null>(null);
  const [isSharingCatalog, setIsSharingCatalog] = useState(false);
  const [lockedService, setLockedService] = useState<Service | null>(null);
  const [serviceSearchTerm, setServiceSearchTerm] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState<ServiceStatusFilter>("all");
  const [serviceEmployeeFilter, setServiceEmployeeFilter] = useState("all");
  const unlockedVisibleServiceIds = new Set(
    isFreePlan(subscriptionTier)
      ? services.filter((service) => service.isVisible).slice(0, freePlanLimits.visibleServices).map((service) => service.id)
      : services.map((service) => service.id)
  );

  const currentStep = serviceWizardStepOrder[currentStepIndex] ?? "details";
  const stepItems = serviceWizardStepOrder.map((step) => ({
    id: step,
    label: messages.services.steps[step]
  }));
  const filteredServices = services.filter((service) => {
    const normalizedSearch = serviceSearchTerm.trim().toLowerCase();
    const matchesSearch = !normalizedSearch || `${service.name} ${service.description}`.toLowerCase().includes(normalizedSearch);
    const matchesStatus = serviceStatusFilter === "all" || (serviceStatusFilter === "visible" ? service.isVisible : !service.isVisible);
    const matchesEmployee = serviceEmployeeFilter === "all" || service.employeeIds.includes(serviceEmployeeFilter);

    return matchesSearch && matchesStatus && matchesEmployee;
  });
  const monthRange = getCurrentMonthRange();

  function startCreate() {
    setDraft(createNewServiceDraft());
    setEditingId(null);
    setCurrentStepIndex(0);
    setPendingServiceImageFile(null);
    setValidationMessage(null);
    setMode("form");
  }

  function startEdit(service: Service) {
    setDraft({ ...service, addons: service.addons.map((addon) => ({ ...addon })), schedule: structuredClone(service.schedule), employeeIds: [...service.employeeIds] });
    setEditingId(service.id);
    setCurrentStepIndex(0);
    setPendingServiceImageFile(null);
    setValidationMessage(null);
    setMode("form");
  }

  function startDuplicate(service: Service) {
    setDraft({
      ...service,
      id: globalThis.crypto.randomUUID(),
      name: `${service.name} ${messages.services.copySuffix}`,
      addons: service.addons.map((addon, index) => ({
        ...addon,
        id: globalThis.crypto.randomUUID(),
        sortOrder: index
      })),
      schedule: structuredClone(service.schedule),
      employeeIds: [...service.employeeIds]
    });
    setEditingId(null);
    setCurrentStepIndex(0);
    setPendingServiceImageFile(null);
    setValidationMessage(null);
    setMode("form");
  }

  function returnToGrid() {
    if (isSavingService) {
      return;
    }

    setMode("grid");
    setEditingId(null);
    setCurrentStepIndex(0);
    setPendingServiceImageFile(null);
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

  function addAddon() {
    setDraft((current) => ({
      ...current,
      addons: [
        ...current.addons,
        {
          id: globalThis.crypto.randomUUID(),
          isActive: true,
          name: "",
          price: 0,
          sortOrder: current.addons.length
        }
      ]
    }));
  }

  function updateAddon(addonId: string, nextAddon: Partial<ServiceAddon>) {
    setDraft((current) => ({
      ...current,
      addons: current.addons.map((addon) => (
        addon.id === addonId ? { ...addon, ...nextAddon } : addon
      ))
    }));
  }

  function removeAddon(addonId: string) {
    setDraft((current) => ({
      ...current,
      addons: current.addons.filter((addon) => addon.id !== addonId)
    }));
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

  async function copyCatalogLink() {
    if (!businessId) {
      onShareError();
      return;
    }

    try {
      await navigator.clipboard.writeText(getPublicCatalogUrl(businessId));
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
    if (isSavingService) {
      return;
    }

    setCurrentStepIndex(index);
    setValidationMessage(null);
  }

  function goToPreviousStep() {
    if (isSavingService) {
      return;
    }

    setCurrentStepIndex((current) => Math.max(current - 1, 0));
    setValidationMessage(null);
  }

  function goToNextStep() {
    if (isSavingService) {
      return;
    }

    const stepValidationMessage = getServiceStepValidationMessage(currentStep, draft, messages, isMercadoPagoConfigured, isTransferConfigured);

    if (stepValidationMessage) {
      setValidationMessage(stepValidationMessage);
      onValidationWarning();
      return;
    }

    setValidationMessage(null);
    setCurrentStepIndex((current) => Math.min(current + 1, serviceWizardStepOrder.length - 1));
  }

  async function submitForm() {
    if (isSavingService) {
      return;
    }

    const invalidStepIndex = serviceWizardStepOrder.findIndex((step) => getServiceStepValidationMessage(step, draft, messages, isMercadoPagoConfigured, isTransferConfigured));

    if (invalidStepIndex >= 0) {
      const invalidStep = serviceWizardStepOrder[invalidStepIndex] ?? "details";
      setCurrentStepIndex(invalidStepIndex);
      setValidationMessage(getServiceStepValidationMessage(invalidStep, draft, messages, isMercadoPagoConfigured, isTransferConfigured));
      onValidationWarning();
      return;
    }

    setIsSavingService(true);

    try {
      if (pendingServiceImageFile && !businessId) {
        throw new Error("No pudimos identificar el negocio para subir la imagen.");
      }

      const serviceToSave = pendingServiceImageFile && businessId
        ? {
            ...draft,
            imageUrl: await uploadBusinessImageAsset({
              businessId,
              file: pendingServiceImageFile,
              path: `${businessId}/services/${draft.id}.webp`
            })
          }
        : draft;
      const didSave = await onSaveService(serviceToSave);

      if (didSave) {
        setMode("grid");
        setEditingId(null);
        setPendingServiceImageFile(null);
        setValidationMessage(null);
      }
    } catch (error) {
      onImageUploadError(error instanceof Error ? error.message : "No pudimos subir la imagen del servicio.");
    } finally {
      setIsSavingService(false);
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
            <Button variant="secondary" disabled={isSavingService} onClick={returnToGrid}>{messages.actions.cancel}</Button>
          }
        />

        <StepProgress steps={stepItems} currentStepIndex={currentStepIndex} onStepSelect={goToStep} />

        <WizardActions
          className="flex"
          currentStep={currentStep}
          currentStepIndex={currentStepIndex}
          isSaving={isSavingService}
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
              <TextField label={messages.services.name} value={draft.name} required onChange={handleTextChange("name")} />
              <ImageUploadField
                label={messages.services.imageUrl}
                value={draft.imageUrl}
                onChange={(value) => setDraft((current) => ({ ...current, imageUrl: value }))}
                onSelectedFileChange={setPendingServiceImageFile}
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
              <TextField label={messages.services.price} inputMode="numeric" pattern="[0-9]*" value={formatNumericInputValue(draft.price, true)} required onChange={handleNumericTextChange("price")} />
              <TextField label={messages.services.durationMinutesLabel} inputMode="numeric" pattern="[0-9]*" value={formatNumericInputValue(draft.durationMinutes)} required onChange={handleNumericTextChange("durationMinutes")} />
              <TextField label={messages.services.capacity} inputMode="numeric" pattern="[0-9]*" value={formatNumericInputValue(draft.capacity)} required onChange={handleNumericTextChange("capacity")} />
              <TextField label={messages.services.deposit} inputMode="numeric" pattern="[0-9]*" value={formatNumericInputValue(draft.deposit, true)} onChange={handleNumericTextChange("deposit")} />
              <TextField label={messages.services.leadTime} inputMode="numeric" pattern="[0-9]*" value={formatNumericInputValue(draft.reservationLeadMinutes)} onChange={handleNumericTextChange("reservationLeadMinutes")} />
              <TextField label={messages.services.cancellationLeadTime} inputMode="numeric" pattern="[0-9]*" value={formatNumericInputValue(draft.cancellationLeadMinutes)} onChange={handleNumericTextChange("cancellationLeadMinutes")} />
              <SelectField
                label={messages.services.paymentMethod}
                value={draft.paymentMethod}
                required
                onChange={handleTextChange("paymentMethod")}
                options={paymentMethods.map((method) => ({
                  value: method,
                  label: messages.paymentMethods[method],
                  disabled: isPaymentMethodDisabled(method, isMercadoPagoConfigured, isTransferConfigured)
                }))}
              />
              {!isMercadoPagoConfigured || !isTransferConfigured ? (
                <p className="rounded-lg border border-warning bg-warning-soft p-3 text-sm leading-6 text-warning lg:col-span-3">
                  {messages.services.paymentMethodDisabledHint}
                </p>
              ) : null}
            </div>
            <ServiceAddonsEditor
              addons={draft.addons}
              messages={messages}
              onAddAddon={addAddon}
              onRemoveAddon={removeAddon}
              onUpdateAddon={updateAddon}
            />
            </FormSection>
          ) : null}

          {currentStep === "staff" ? (
            <FormSection title={messages.services.staffSection} description={messages.services.staffSectionHint}>
            {employees.length > 0 ? (
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
            ) : (
              <p className="rounded-lg border border-subtle bg-input p-4 text-sm font-semibold text-muted">
                {messages.services.emptyAssignedStaff}
              </p>
            )}
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
          isSaving={isSavingService}
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" icon={<FiShare2 />} disabled={!businessId} onClick={() => setIsSharingCatalog(true)}>
              {messages.services.shareCatalogAction}
            </Button>
            <Button icon={<FiPlus />} onClick={startCreate}>
              {messages.actions.addService}
            </Button>
          </div>
        }
      />

      <Card className="flex items-start gap-3 bg-brand-soft">
        <FiInfo className="mt-1 shrink-0 text-brand-strong" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold text-primary">{messages.services.disclaimerTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{messages.services.disclaimerDescription}</p>
        </div>
      </Card>

      <ServiceFilters
        messages={messages}
        employees={employees}
        searchTerm={serviceSearchTerm}
        statusFilter={serviceStatusFilter}
        employeeFilter={serviceEmployeeFilter}
        onSearchChange={setServiceSearchTerm}
        onStatusChange={setServiceStatusFilter}
        onEmployeeChange={setServiceEmployeeFilter}
      />

      <section className="overflow-hidden rounded-3xl border border-subtle bg-surface shadow-sm">
        {filteredServices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] border-collapse text-left">
              <thead className="bg-shell text-xs font-bold uppercase tracking-[0.04em] text-muted">
                <tr>
                  <th className="px-4 py-3">{messages.services.serviceColumn}</th>
                  <th className="px-4 py-3">{messages.services.duration}</th>
                  <th className="px-4 py-3">{messages.services.price}</th>
                  <th className="px-4 py-3">{messages.services.professionalsColumn}</th>
                  <th className="px-4 py-3">{messages.services.monthBookings}</th>
                  <th className="px-4 py-3">{messages.services.statusColumn}</th>
                  <th className="px-4 py-3 text-right">{messages.services.actionsColumn}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {filteredServices.map((service) => {
                  const isLockedByPlan = isFreePlan(subscriptionTier) && service.isVisible && !unlockedVisibleServiceIds.has(service.id);
                  const serviceEmployees = employees.filter((employee) => service.employeeIds.includes(employee.id));
                  const monthBookings = countServiceAppointmentsForMonth(service.id, appointments, monthRange);

                  return (
                    <tr key={service.id} className="relative transition-colors hover:bg-brand-soft/45">
                      <td className="px-4 py-4">
                        <div className={cx("flex min-w-0 items-center gap-3", isLockedByPlan && "opacity-50 grayscale blur-[1px]")}>
                          <ServiceImagePreview service={service} messages={messages} />
                          <div className="min-w-0">
                            <h2 className="truncate text-sm font-bold text-primary">{service.name}</h2>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{service.description || messages.services.emptyDescription}</p>
                          </div>
                        </div>
                      </td>
                      <td className={cx("px-4 py-4 text-sm font-semibold text-primary", isLockedByPlan && "opacity-50 grayscale blur-[1px]")}>
                        {service.durationMinutes} {messages.services.minutesShort}
                      </td>
                      <td className={cx("px-4 py-4 text-sm", isLockedByPlan && "opacity-50 grayscale blur-[1px]")}>
                        <p className="font-bold text-primary">{formatCurrency(service.price)}</p>
                        {service.deposit > 0 ? (
                          <p className="mt-1 text-xs font-semibold text-muted">{messages.services.depositShort} {formatCurrency(service.deposit)}</p>
                        ) : null}
                      </td>
                      <td className={cx("px-4 py-4", isLockedByPlan && "opacity-50 grayscale blur-[1px]")}>
                        <ServiceEmployeePills messages={messages} employees={serviceEmployees} />
                      </td>
                      <td className={cx("px-4 py-4 text-sm font-semibold text-primary", isLockedByPlan && "opacity-50 grayscale blur-[1px]")}>
                        {monthBookings}
                      </td>
                      <td className={cx("px-4 py-4", isLockedByPlan && "opacity-50 grayscale blur-[1px]")}>
                        <VisibilitySwitch
                          messages={messages}
                          isVisible={service.isVisible}
                          isLoading={savingVisibilityId === service.id}
                          isDisabled={isLockedByPlan}
                          onToggle={() => void toggleServiceVisibility(service)}
                        />
                      </td>
                      <td className="px-4 py-4 text-right">
                        {isLockedByPlan ? (
                          <button
                            type="button"
                            className="rounded-full border border-brand bg-surface px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-strong shadow-sm"
                            onClick={() => setLockedService(service)}
                          >
                            {messages.planLimits.lockedCardHint}
                          </button>
                        ) : (
                          <ServiceActionsMenu
                            messages={messages}
                            service={service}
                            onShare={() => setSharingService(service)}
                            onEdit={() => startEdit(service)}
                            onDuplicate={() => startDuplicate(service)}
                            onDelete={() => void onDeleteService(service.id)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-sm text-muted">{services.length > 0 ? messages.services.noResults : messages.services.empty}</p>
          </div>
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

      {isSharingCatalog && businessId ? (
        <ShareCatalogModal
          messages={messages}
          catalogUrl={getPublicCatalogUrl(businessId)}
          onClose={() => setIsSharingCatalog(false)}
          onCopy={() => void copyCatalogLink()}
        />
      ) : null}

      <PlanLimitModal
        isOpen={Boolean(lockedService)}
        badge={messages.planLimits.lockedBadge}
        title={messages.planLimits.lockedServiceTitle}
        description={messages.planLimits.lockedServiceDescription}
        actionLabel={messages.planLimits.lockedAction}
        onClose={() => setLockedService(null)}
      />
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
    <div className="p-safe fixed inset-0 z-50 grid place-items-center bg-primary/35">
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

function ShareCatalogModal({
  messages,
  catalogUrl,
  onClose,
  onCopy
}: {
  messages: Messages;
  catalogUrl: string;
  onClose: () => void;
  onCopy: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let isActive = true;

    void QRCode.toDataURL(catalogUrl, {
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
  }, [catalogUrl]);

  return (
    <div className="p-safe fixed inset-0 z-50 grid place-items-center bg-primary/35">
      <Card className="grid w-fit max-w-full gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-muted">{messages.actions.share}</p>
            <h2 className="mt-1 text-2xl font-bold text-primary">{messages.services.shareCatalogTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{messages.services.shareCatalogDescription}</p>
          </div>
          <Button size="icon" variant="ghost" aria-label={messages.actions.cancel} onClick={onClose}>
            <FiX />
          </Button>
        </div>

        <div className="grid justify-items-center gap-4 rounded-xl border border-subtle bg-input p-5">
          {qrDataUrl ? (
            <Image
              src={qrDataUrl}
              alt={messages.services.shareCatalogQrAlt}
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
            <span className="truncate">{catalogUrl}</span>
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

function getPublicCatalogUrl(businessId: string) {
  return `${window.location.origin}/catalogo/${businessId}`;
}

function ServiceFilters({
  messages,
  employees,
  searchTerm,
  statusFilter,
  employeeFilter,
  onSearchChange,
  onStatusChange,
  onEmployeeChange
}: {
  messages: Messages;
  employees: Employee[];
  searchTerm: string;
  statusFilter: ServiceStatusFilter;
  employeeFilter: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ServiceStatusFilter) => void;
  onEmployeeChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_auto_auto]">
      <label className="h-fit relative block">
        <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <span className="sr-only">{messages.services.searchPlaceholder}</span>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={messages.services.searchPlaceholder}
          className="h-11 w-full rounded-xl border border-subtle bg-input px-4 pl-10 text-sm text-primary shadow-sm outline-none transition placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-focus"
        />
      </label>

      <SelectField
        value={statusFilter}
        onChange={(event) => onStatusChange(event.target.value as ServiceStatusFilter)}
        className="rounded-xl font-semibold shadow-sm md:w-44"
        options={[
          { value: "all", label: messages.services.allStatuses },
          { value: "visible", label: messages.services.visible },
          { value: "hidden", label: messages.services.hidden }
        ]}
      />

      <SelectField
        value={employeeFilter}
        onChange={(event) => onEmployeeChange(event.target.value)}
        className="rounded-xl font-semibold shadow-sm md:w-56"
        options={[
          { value: "all", label: messages.services.allProfessionals },
          ...employees.map((employee) => ({
            value: employee.id,
            label: employee.name
          }))
        ]}
      />
    </div>
  );
}

function ServiceImagePreview({ service, messages }: { service: Service; messages: Messages }) {
  return (
    <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-subtle bg-shell">
      {service.imageUrl ? (
        <span
          className="absolute inset-0 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${service.imageUrl})` }}
        />
      ) : (
        <Image
          src="/branding/short-logo.png"
          alt={messages.appName}
          width={32}
          height={32}
          className="h-8 w-8 object-contain"
        />
      )}
    </span>
  );
}

function ServiceEmployeePills({ messages, employees }: { messages: Messages; employees: Employee[] }) {
  const visibleEmployees = employees.slice(0, visibleServiceEmployeeLimit);
  const hiddenCount = Math.max(employees.length - visibleServiceEmployeeLimit, 0);

  if (employees.length === 0) {
    return <span className="text-sm text-muted">{messages.services.noProfessionals}</span>;
  }

  return (
    <div className="flex max-w-64 flex-nowrap items-center gap-2">
      {visibleEmployees.map((employee) => (
        <span key={employee.id} className="max-w-36 truncate rounded-full bg-shell px-3 py-1 text-xs font-semibold text-primary">
          {employee.name}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="shrink-0 rounded-full bg-shell px-3 py-1 text-xs font-semibold text-primary">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

function ServiceActionsMenu({
  messages,
  service,
  onShare,
  onEdit,
  onDuplicate,
  onDelete
}: {
  messages: Messages;
  service: Service;
  onShare: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function positionMenu() {
      const rect = buttonRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const menuWidth = menuRef.current?.offsetWidth ?? 160;
      const menuHeight = menuRef.current?.offsetHeight ?? 180;
      const gap = 8;
      const viewportPadding = 16;
      const opensUpward = rect.bottom + gap + menuHeight > window.innerHeight - viewportPadding;

      setMenuPosition({
        left: Math.min(
          Math.max(viewportPadding, rect.right - menuWidth),
          window.innerWidth - menuWidth - viewportPadding
        ),
        top: opensUpward
          ? Math.max(viewportPadding, rect.top - menuHeight - gap)
          : rect.bottom + gap
      });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  function closeAndRun(action: () => void) {
    setIsOpen(false);
    action();
  }

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full text-muted transition hover:bg-shell hover:text-primary [&::-webkit-details-marker]:hidden"
        aria-label={messages.actions.openMenu}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <FiMoreHorizontal aria-hidden="true" />
      </button>
      {isOpen ? (
        <div
          ref={menuRef}
          className="fixed z-50 grid min-w-40 overflow-hidden rounded-xl border border-subtle bg-surface p-1 text-sm shadow-lg"
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-primary hover:bg-shell disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!service.isVisible}
          title={!service.isVisible ? messages.services.shareHiddenHint : messages.actions.share}
          onClick={() => closeAndRun(onShare)}
        >
          <FiShare2 aria-hidden="true" />
          {messages.actions.share}
        </button>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-primary hover:bg-shell"
          onClick={() => closeAndRun(onEdit)}
        >
          <FiEdit2 aria-hidden="true" />
          {messages.actions.edit}
        </button>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-primary hover:bg-shell"
          onClick={() => closeAndRun(onDuplicate)}
        >
          <FiCopy aria-hidden="true" />
          {messages.actions.duplicate}
        </button>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-danger hover:bg-danger-soft"
          onClick={() => closeAndRun(onDelete)}
        >
          <FiTrash2 aria-hidden="true" />
          {messages.actions.delete}
        </button>
      </div>
      ) : null}
    </div>
  );
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
  isSaving,
  messages,
  onCancel,
  onPrevious,
  onNext,
  onSubmit
}: {
  className?: string;
  currentStep: ServiceWizardStep;
  currentStepIndex: number;
  isSaving: boolean;
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
          <Button className="w-full sm:w-auto" variant="secondary" disabled={isSaving} onClick={onCancel}>
            {messages.actions.cancel}
          </Button>
          <Button className="w-full sm:w-auto" variant="secondary" icon={<FiArrowLeft />} disabled={isSaving} onClick={onPrevious}>
            {messages.actions.back}
          </Button>
        </div>
      ) : (
        <Button className="w-1/2 sm:w-auto" variant="secondary" disabled={isSaving} onClick={onCancel}>
          {messages.actions.cancel}
        </Button>
      )}

      {currentStep === "review" ? (
        <Button className="w-1/2 sm:w-auto" icon={<FiCheck />} isLoading={isSaving} onClick={onSubmit}>
          {messages.actions.save}
        </Button>
      ) : (
        <Button className="w-1/2 sm:w-auto" icon={<FiArrowRight />} disabled={isSaving} onClick={onNext}>
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
  isDisabled = false,
  onToggle
}: {
  messages: Messages;
  isVisible: boolean;
  isLoading: boolean;
  isDisabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isVisible}
      disabled={isLoading || isDisabled}
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
  const activeAddons = service.addons.filter((addon) => addon.name.trim() && addon.isActive);

  return (
    <FormSection title={messages.services.reviewSection} description={messages.services.reviewSectionHint}>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div
          className="min-h-56 rounded-lg bg-surface-strong bg-contain bg-center bg-no-repeat"
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
            <ServiceFact label={messages.services.cancellationLeadTime} value={formatLeadTime(service.cancellationLeadMinutes)} />
            <ServiceFact label={messages.services.schedule} value={`${scheduleRangeCount} ${messages.services.ranges}`} />
          </dl>
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="text-sm font-bold text-primary">{messages.services.addonsSection}</h3>
        {activeAddons.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {activeAddons.map((addon) => (
              <div key={addon.id} className="rounded-lg border border-subtle bg-input p-3">
                <p className="text-sm font-semibold text-primary">{addon.name}</p>
                <p className="mt-1 text-sm text-muted">+ {formatCurrency(addon.price)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-subtle bg-input p-3 text-sm text-muted">{messages.services.emptyAddons}</p>
        )}
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

function ServiceAddonsEditor({
  addons,
  messages,
  onAddAddon,
  onRemoveAddon,
  onUpdateAddon
}: {
  addons: ServiceAddon[];
  messages: Messages;
  onAddAddon: () => void;
  onRemoveAddon: (addonId: string) => void;
  onUpdateAddon: (addonId: string, addon: Partial<ServiceAddon>) => void;
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-subtle bg-surface p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-primary">{messages.services.addonsSection}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">{messages.services.addonsSectionHint}</p>
        </div>
        <Button size="sm" variant="secondary" icon={<FiPlus />} onClick={onAddAddon}>
          {messages.services.addAddon}
        </Button>
      </div>

      {addons.length > 0 ? (
        <div className="grid gap-3">
          {addons.map((addon) => (
            <div key={addon.id} className="grid gap-3 rounded-lg border border-subtle bg-input p-3 lg:grid-cols-[1fr_180px_120px_auto] lg:items-end">
              <TextField
                label={messages.services.addonName}
                value={addon.name}
                required
                onChange={(event) => onUpdateAddon(addon.id, { name: event.target.value })}
              />
              <TextField
                label={messages.services.addonPrice}
                inputMode="numeric"
                pattern="[0-9]*"
                value={formatNumericInputValue(addon.price, true)}
                required
                onChange={(event) => onUpdateAddon(addon.id, { price: parseNumericInput(event.target.value) })}
              />
              <CheckboxField
                label={messages.services.addonActive}
                checked={addon.isActive}
                onChange={(event) => onUpdateAddon(addon.id, { isActive: event.target.checked })}
              />
              <Button size="icon" variant="ghost" aria-label={messages.actions.delete} onClick={() => onRemoveAddon(addon.id)}>
                <FiTrash2 />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-subtle bg-input p-3 text-sm text-muted">{messages.services.emptyAddons}</p>
      )}
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

function getServiceStepValidationMessage(
  step: ServiceWizardStep,
  service: Service,
  messages: Messages,
  isMercadoPagoConfigured: boolean,
  isTransferConfigured: boolean
) {
  if (step === "details" && !service.name.trim()) {
    return messages.services.validation.details;
  }

  if (step === "booking" && !hasValidBookingNumbers(service)) {
    return messages.services.validation.booking;
  }

  if (step === "booking" && isPaymentMethodDisabled(service.paymentMethod, isMercadoPagoConfigured, isTransferConfigured)) {
    return messages.services.validation.paymentMethod;
  }

  if (step === "staff" && service.employeeIds.length === 0) {
    return messages.services.validation.staff;
  }

  if (step === "schedule" && getScheduleRangeCount(service.schedule) === 0) {
    return messages.services.validation.schedule;
  }

  return null;
}

function isPaymentMethodDisabled(
  paymentMethod: PaymentMethod,
  isMercadoPagoConfigured: boolean,
  isTransferConfigured: boolean
) {
  if (paymentMethod === "card") {
    return !isMercadoPagoConfigured;
  }

  if (paymentMethod === "transfer") {
    return !isTransferConfigured;
  }

  if (paymentMethod === "mixed") {
    return !isMercadoPagoConfigured || !isTransferConfigured;
  }

  return false;
}

function hasValidBookingNumbers(service: Service) {
  const numericValues = [
    service.price,
    service.durationMinutes,
    service.capacity,
    service.deposit,
    service.reservationLeadMinutes,
    service.cancellationLeadMinutes
  ];

  return (
    numericValues.every((value) => Number.isInteger(value) && value >= 0) &&
    service.price > 0 &&
    service.durationMinutes > 0 &&
    service.capacity >= 1
  );
}

function getScheduleRangeCount(schedule: ServiceSchedule) {
  return Object.values(schedule).reduce((total, ranges) => total + ranges.length, 0);
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    start: formatDateKey(start),
    end: formatDateKey(end)
  };
}

function countServiceAppointmentsForMonth(
  serviceId: string,
  appointments: Appointment[],
  monthRange: { start: string; end: string }
) {
  return appointments.filter((appointment) => (
    appointment.serviceId === serviceId &&
    appointment.status !== "cancelled" &&
    appointment.date >= monthRange.start &&
    appointment.date <= monthRange.end
  )).length;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatLeadTime(minutes: number) {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;

    return `${days} ${days === 1 ? "dia" : "dias"}`;
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60;

    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }

  return `${minutes} minutos`;
}

function formatNumericInputValue(value: number, hideZero = false) {
  return hideZero && value === 0 ? "" : String(value);
}

function parseNumericInput(value: string) {
  const digits = value.replace(/\D/g, "");

  return digits ? Number(digits) : 0;
}
