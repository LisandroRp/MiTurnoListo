import { useState } from "react";
import { FiCalendar, FiEdit2, FiPlus, FiTrash2, FiX } from "react-icons/fi";

import { employeeColorClasses, employeeToneClasses } from "@/features/scheduling/components/employeeColors";
import { cx } from "@/components/ui/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { isDateBlocked } from "@/features/booking-flow/utils/booking";
import { Messages } from "@/features/scheduling/i18n/messages";
import { isValidSpecialAvailability } from "@/features/scheduling/special-availability";
import { BusinessDayBlock, Employee, Service, SpecialAvailability } from "@/features/scheduling/types";
import { getDateLabel } from "@/features/scheduling/utils/format";

type Props = {
  services: Service[];
  employees: Employee[];
  dayBlocks: BusinessDayBlock[];
  messages: Messages;
  initialDate: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (opening: SpecialAvailability) => Promise<boolean> | void;
  onDelete: (id: string) => Promise<boolean> | void;
};

type Draft = Omit<SpecialAvailability, "id"> & { id?: string };
const emptyDraft: Draft = { serviceId: "", date: "", start: "09:00", end: "13:00", employeeIds: [] };

export function SpecialAvailabilityModal({ services, employees, dayBlocks, messages, initialDate, isOpen, onClose, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft, date: initialDate });
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const copy = messages.calendar.exceptional;
  const today = new Date();
  const minimumDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const service = services.find((item) => item.id === draft.serviceId && !item.isArchived);
  const assignedEmployees = employees.filter((employee) => !employee.isArchived && service?.employeeIds.includes(employee.id));
  const openings = services.flatMap((item) => item.specialAvailability ?? []).filter((item) => item.date >= minimumDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

  function updateDraft(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
    setError("");
  }

  async function save() {
    const opening = { ...draft, id: draft.id ?? globalThis.crypto.randomUUID() };
    if (!isValidSpecialAvailability(opening) || opening.date < minimumDate || !service || opening.employeeIds.some((id) => !assignedEmployees.some((employee) => employee.id === id))) {
      setError(copy.invalid);
      return;
    }
    if (opening.employeeIds.some((id) => isDateBlocked(opening.date, dayBlocks, id))) {
      setError(copy.blocked);
      return;
    }
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    if (minutes(opening.end) - minutes(opening.start) < service.durationMinutes) {
      setError(copy.shortRange);
      return;
    }
    setPending("save");
    setError("");
    try {
      if (await onSave(opening) === false) { setError(copy.saveError); return; }
      setDraft({ ...emptyDraft, date: opening.date });
    } catch {
      setError(copy.saveError);
    } finally {
      setPending(null);
    }
  }

  async function remove(id: string) {
    setPending(id);
    setError("");
    try {
      if (await onDelete(id) === false) { setError(copy.deleteError); return; }
      if (draft.id === id) setDraft({ ...emptyDraft, date: draft.date });
    } catch {
      setError(copy.deleteError);
    } finally {
      setPending(null);
    }
  }

  return (
    <Modal isOpen={isOpen} className="max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary">{copy.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{copy.description}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label={messages.actions.cancel} disabled={pending !== null} onClick={onClose}><FiX aria-hidden="true" /></Button>
      </div>
      <div className="mt-5 grid gap-4 border-t border-subtle pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={copy.date} type="date" min={minimumDate} value={draft.date} disabled={pending !== null} onChange={(event) => updateDraft({ date: event.target.value })} />
          <SelectField label={copy.service} value={draft.serviceId} disabled={pending !== null} options={[
            { value: "", label: copy.chooseService },
            ...services.filter((item) => !item.isArchived).map((item) => ({ value: item.id, label: item.name }))
          ]} onChange={(event) => updateDraft({ serviceId: event.target.value, employeeIds: [] })} />
          <TextField label={copy.start} type="time" value={draft.start} disabled={pending !== null} onChange={(event) => updateDraft({ start: event.target.value })} />
          <TextField label={copy.end} type="time" value={draft.end} disabled={pending !== null} onChange={(event) => updateDraft({ end: event.target.value })} />
        </div>
        <fieldset className="grid gap-2" disabled={pending !== null}>
          <legend className="mb-2 text-sm font-semibold text-primary">{copy.employees}</legend>
          {assignedEmployees.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {assignedEmployees.map((employee) => (
                <label
                  key={employee.id}
                  className={cx(
                    "flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition duration-200 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus",
                    employeeToneClasses[employee.color] ?? employeeToneClasses["employee-blue"],
                    draft.employeeIds.includes(employee.id) ? "ring-2 ring-brand/20" : ""
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cx("h-3 w-3 shrink-0 rounded-full", employeeColorClasses[employee.color] ?? employeeColorClasses["employee-blue"])} aria-hidden="true" />
                    <span className="min-w-0 truncate text-sm font-bold text-primary">{employee.name}</span>
                  </span>
                  <input
                    type="checkbox"
                    aria-label={employee.name}
                    checked={draft.employeeIds.includes(employee.id)}
                    onChange={(event) => updateDraft({ employeeIds: event.target.checked ? [...draft.employeeIds, employee.id] : draft.employeeIds.filter((id) => id !== employee.id) })}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-brand"
                  />
                </label>
              ))}
            </div>
          ) : <p className="text-sm text-muted">{service ? copy.noEmployees : copy.chooseServiceHint}</p>}
        </fieldset>
        <p className="text-xs leading-5 text-muted">{copy.blockedHint}</p>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          {draft.id ? <Button variant="ghost" disabled={pending !== null} onClick={() => { setDraft({ ...emptyDraft, date: draft.date }); setError(""); }}>{messages.actions.cancel}</Button> : null}
          <Button icon={<FiPlus />} isLoading={pending === "save"} disabled={pending !== null || !assignedEmployees.length} onClick={() => void save()}>{draft.id ? messages.actions.save : copy.add}</Button>
        </div>
      </div>
      <div className="mt-6 grid gap-3 border-t border-subtle pt-5">
        <h3 className="font-bold text-primary">{copy.upcoming}</h3>
        {openings.length ? openings.map((opening) => (
          <div key={opening.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-subtle p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary"><FiCalendar className="mr-1 inline text-brand-strong" aria-hidden="true" />{getDateLabel(opening.date)} · {opening.start}–{opening.end}</p>
              <p className="mt-1 break-words text-sm text-primary">{services.find((item) => item.id === opening.serviceId)?.name ?? copy.service}</p>
              <p className="mt-1 break-words text-xs text-muted">{opening.employeeIds.map((id) => employees.find((employee) => employee.id === id)?.name ?? copy.unknownEmployee).join(" · ")}</p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" aria-label={messages.actions.edit} disabled={pending !== null} onClick={() => { setDraft({ ...opening, employeeIds: [...opening.employeeIds] }); setError(""); }}><FiEdit2 aria-hidden="true" /></Button>
              <Button variant="ghost" size="icon" aria-label={messages.actions.delete} className="text-danger" isLoading={pending === opening.id} disabled={pending !== null} onClick={() => void remove(opening.id)}><FiTrash2 aria-hidden="true" /></Button>
            </div>
          </div>
        )) : <p className="text-sm text-muted">{copy.empty}</p>}
        <p className="text-xs text-muted">{copy.deleteHint}</p>
      </div>
    </Modal>
  );
}
