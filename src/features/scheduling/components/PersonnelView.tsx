import { ChangeEvent, ReactNode, useRef, useState } from "react";
import { FiEdit2, FiInfo, FiPlus, FiTrash2 } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { AvailabilityEditor } from "@/features/scheduling/components/AvailabilityEditor";
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

  function startCreate() {
    setDraft(createNewEmployeeDraft());
    setEditingId(null);
    setMode("form");
  }

  function startEdit(employee: Employee) {
    setDraft({ ...employee, schedule: structuredClone(employee.schedule) });
    setEditingId(employee.id);
    setMode("form");
  }

  function returnToGrid() {
    setMode("grid");
    setEditingId(null);
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

  async function submitForm() {
    if (!draft.name.trim() || !draft.role.trim()) {
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
            <>
              <Button variant="secondary" onClick={returnToGrid}>{messages.actions.cancel}</Button>
              <Button onClick={submitForm}>{messages.actions.save}</Button>
            </>
          }
        />

        <div className="grid gap-5">
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

          <FormSection title={messages.personnel.scheduleSection} description={messages.personnel.scheduleSectionHint}>
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
          <Card key={employee.id} className="flex h-full w-full flex-col overflow-hidden p-0">
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
