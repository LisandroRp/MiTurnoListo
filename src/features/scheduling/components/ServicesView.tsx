import { ChangeEvent, ReactNode, useRef, useState } from "react";
import { FiEdit2, FiInfo, FiPlus, FiTrash2 } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { SelectField } from "@/components/ui/SelectField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { AvailabilityEditor } from "@/features/scheduling/components/AvailabilityEditor";
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
};

type ServicesMode = "grid" | "form";

const paymentMethods: PaymentMethod[] = ["cash", "card", "transfer", "mixed"];

export function ServicesView({
  messages,
  services,
  employees,
  onSaveService,
  onDeleteService,
  onValidationWarning,
  onImageUploadError
}: ServicesViewProps) {
  const rangeIdCounter = useRef(1);
  const [mode, setMode] = useState<ServicesMode>("grid");
  const [draft, setDraft] = useState<Service>(() => createNewServiceDraft(employees.map((employee) => employee.id)));
  const [editingId, setEditingId] = useState<string | null>(null);

  function startCreate() {
    setDraft(createNewServiceDraft(employees.map((employee) => employee.id)));
    setEditingId(null);
    setMode("form");
  }

  function startEdit(service: Service) {
    setDraft({ ...service, schedule: structuredClone(service.schedule), employeeIds: [...service.employeeIds] });
    setEditingId(service.id);
    setMode("form");
  }

  function returnToGrid() {
    setMode("grid");
    setEditingId(null);
  }

  function handleTextChange(field: keyof Service) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setDraft((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  function handleNumberChange(field: keyof Service) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setDraft((current) => ({ ...current, [field]: Number(event.target.value) }));
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

  async function submitForm() {
    if (!draft.name.trim() || draft.price <= 0 || draft.durationMinutes <= 0 || draft.capacity <= 0 || draft.employeeIds.length === 0) {
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
            <>
              <Button variant="secondary" onClick={returnToGrid}>{messages.actions.cancel}</Button>
              <Button onClick={submitForm}>{messages.actions.save}</Button>
            </>
          }
        />

        <div className="grid gap-5">
          <FormSection title={messages.services.detailsSection} description={messages.services.detailsSectionHint}>
            <div className="grid items-start gap-4 lg:grid-cols-2">
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

          <FormSection title={messages.services.bookingSection} description={messages.services.bookingSectionHint}>
            <div className="grid gap-4 lg:grid-cols-3">
              <TextField label={messages.services.price} type="number" min={0} value={draft.price} onChange={handleNumberChange("price")} />
              <TextField label={messages.services.duration} type="number" min={5} value={draft.durationMinutes} onChange={handleNumberChange("durationMinutes")} />
              <TextField label={messages.services.capacity} type="number" min={1} value={draft.capacity} onChange={handleNumberChange("capacity")} />
              <TextField label={messages.services.deposit} type="number" min={0} value={draft.deposit} onChange={handleNumberChange("deposit")} />
              <TextField label={messages.services.leadTime} type="number" min={0} value={draft.reservationLeadMinutes} onChange={handleNumberChange("reservationLeadMinutes")} />
              <SelectField
                label={messages.services.paymentMethod}
                value={draft.paymentMethod}
                onChange={handleTextChange("paymentMethod")}
                options={paymentMethods.map((method) => ({ value: method, label: messages.paymentMethods[method] }))}
              />
            </div>
          </FormSection>

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

          <FormSection title={messages.services.scheduleSection} description={messages.services.scheduleSectionHint}>
            <AvailabilityEditor
              messages={messages}
              schedule={draft.schedule}
              onAddRange={addRange}
              onUpdateRange={updateRange}
              onRemoveRange={removeRange}
            />
          </FormSection>
        </div>
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
                <Badge tone={service.isVisible ? "success" : "neutral"}>
                  {service.isVisible ? messages.services.visible : messages.services.hidden}
                </Badge>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <ServiceFact label={messages.services.price} value={formatCurrency(service.price)} />
                <ServiceFact label={messages.services.duration} value={`${service.durationMinutes} ${messages.services.minutes}`} />
                <ServiceFact label={messages.services.capacity} value={`${service.capacity} ${messages.services.people}`} />
                <ServiceFact label={messages.services.deposit} value={formatCurrency(service.deposit)} />
              </dl>

              <div className="mt-auto grid gap-2 border-t border-subtle pt-4">
                <Button className="w-full" variant="secondary" size="sm" icon={<FiEdit2 />} onClick={() => startEdit(service)}>
                  {messages.actions.edit}
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
