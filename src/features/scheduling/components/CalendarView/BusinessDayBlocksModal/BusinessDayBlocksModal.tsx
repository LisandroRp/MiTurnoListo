import { useState } from "react";
import { FiCalendar, FiTrash2, FiX } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SelectField } from "@/components/ui/SelectField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { Messages } from "@/features/scheduling/i18n/messages";
import { BusinessDayBlock, Employee } from "@/features/scheduling/types";
import { DayBlockTab, getVisibleDayBlocksForTab, getTimedBlockEnd } from "@/features/scheduling/utils/day-blocks";
import { getDateLabel } from "@/features/scheduling/utils/format";

type BusinessDayBlocksModalProps = {
  target: DayBlockTab;
  dayBlocks: BusinessDayBlock[];
  employees: Employee[];
  isOpen: boolean;
  messages: Messages;
  onClose: () => void;
  onDelete: (dayBlockId: string) => Promise<boolean> | void;
  onSave: (dayBlock: BusinessDayBlock) => Promise<boolean> | void;
};

type Draft = {
  endsOn: string;
  employeeId: string;
  reason: string;
  startsOn: string;
  mode: "day" | "hours";
  startTime: string;
  hours: string;
  minutes: string;
};

const defaultDraft: Draft = {
  endsOn: "",
  employeeId: "",
  reason: "",
  startsOn: "",
  mode: "day",
  startTime: "",
  hours: "0",
  minutes: "0"
};

export function BusinessDayBlocksModal({
  target,
  dayBlocks,
  employees,
  isOpen,
  messages,
  onClose,
  onDelete,
  onSave
}: BusinessDayBlocksModalProps) {
  const [draft, setDraft] = useState(defaultDraft);
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState<"save" | string | null>(null);
  const minimumBlockDate = getTomorrowDateValue();
  const sortedDayBlocks = getVisibleDayBlocksForTab(dayBlocks, target, minimumBlockDate);
  const availableEmployees = employees.filter((employee) => !employee.isArchived);
  const employeeNames = new Map(employees.map((employee) => [employee.id, employee.name]));

  function updateDraft(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  const isHourly = target === "employee" && draft.mode === "hours";
  const startsOn = draft.startsOn.trim();
  const endsOn = isHourly ? startsOn : draft.endsOn.trim();
  const endTime = isHourly ? getTimedBlockEnd(draft.startTime, draft.hours, draft.minutes) : null;
  const hasValidEmployee = target === "business" || availableEmployees.some((employee) => employee.id === draft.employeeId);
  const canSave = isOpen && loadingAction === null && hasValidEmployee &&
    isValidDateRange(startsOn, endsOn) && startsOn >= minimumBlockDate && endsOn >= minimumBlockDate &&
    (!isHourly || endTime !== null);

  function closeModal() {
    setDraft(defaultDraft);
    setError("");
    onClose();
  }

  async function saveDayBlock() {
    if (!isOpen || loadingAction !== null) return;
    if (isHourly && !endTime) {
      setError(messages.calendar.blockedHoursInvalid);
      return;
    }
    const reason = draft.reason.trim() || (target === "employee"
      ? messages.calendar.blockedEmployeeDefaultReason
      : messages.calendar.blockedDayDefaultReason);

    if (!isValidDateRange(startsOn, endsOn)) {
      setError(messages.calendar.blockedDayInvalid);
      return;
    }

    if (startsOn < minimumBlockDate || endsOn < minimumBlockDate) {
      setError(messages.calendar.blockedDayPastDate);
      return;
    }

    if (!hasValidEmployee) {
      setError(messages.calendar.blockedEmployeeInvalid);
      return;
    }

    setLoadingAction("save");

    try {
      const didSave = await onSave({
        id: crypto.randomUUID(),
        startsOn,
        endsOn,
        startTime: isHourly ? draft.startTime : null,
        endTime,
        reason,
        employeeId: target === "employee" ? draft.employeeId : null
      });

      if (didSave !== false) {
        setDraft(defaultDraft);
        setError("");
      } else {
        setError(messages.calendar.blockedSaveFailed);
      }
    } catch {
      setError(messages.calendar.blockedSaveFailed);
    } finally {
      setLoadingAction(null);
    }
  }

  async function deleteDayBlock(dayBlockId: string) {
    setLoadingAction(dayBlockId);

    try {
      await onDelete(dayBlockId);
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <Modal isOpen={isOpen} className="max-h-[calc(100vh-2rem)] max-w-lg overflow-y-auto">
      <div className="grid gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{messages.calendar.blockedDaysEyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold text-primary">{target === "employee" ? messages.calendar.blockedEmployeeTitle : messages.calendar.blockedBusinessTitle}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{target === "employee" ? messages.calendar.blockedEmployeeDescription : messages.calendar.blockedBusinessDescription}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label={messages.actions.closeMenu}
            disabled={loadingAction !== null}
            onClick={closeModal}
          >
            <FiX />
          </Button>
        </div>

        <fieldset disabled={loadingAction !== null} className="grid min-w-0 gap-4 rounded-xl border border-subtle bg-input p-4">
          {target === "employee" ? (
            <SelectField
              label={messages.calendar.blockedEmployeeLabel}
              name="blocked-day-employee"
              value={draft.employeeId}
              required
              options={[
                { value: "", label: messages.calendar.blockedEmployeePlaceholder, disabled: true },
                ...availableEmployees.map((employee) => ({ value: employee.id, label: employee.name }))
              ]}
              onChange={(event) => updateDraft("employeeId", event.target.value)}
            />
          ) : null}
          {target === "employee" ? (
            <SegmentedControl
              label={messages.calendar.blockedMode}
              variant="tabs"
              size="md"
              value={draft.mode}
              options={[
                { value: "day", label: messages.calendar.blockedFullDay },
                { value: "hours", label: messages.calendar.blockedHours }
              ]}
              onChange={(value) => updateDraft("mode", value)}
            />
          ) : null}
          <div className={isHourly ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
            <TextField
              label={isHourly ? messages.calendar.blockedDate : messages.calendar.blockedFrom}
              name="blocked-day-start"
              type="date"
              min={minimumBlockDate}
              value={draft.startsOn}
              required
              onChange={(event) => updateDraft("startsOn", event.target.value)}
            />
            {!isHourly ? <TextField
              label={messages.calendar.blockedUntil}
              name="blocked-day-end"
              type="date"
              min={draft.startsOn || minimumBlockDate}
              value={draft.endsOn}
              required
              onChange={(event) => updateDraft("endsOn", event.target.value)}
            /> : null}
          </div>
          {isHourly ? (
            <div className="grid gap-4">
              <TextField label={messages.calendar.blockedStartsAt} name="blocked-start-time" type="time" value={draft.startTime} required onChange={(event) => updateDraft("startTime", event.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <TextField label={messages.calendar.blockedDurationHours} name="blocked-duration-hours" type="number" min="0" max="24" step="1" value={draft.hours} required onChange={(event) => updateDraft("hours", event.target.value)} />
                <TextField label={messages.calendar.blockedDurationMinutes} name="blocked-duration-minutes" type="number" min="0" max="59" step="1" value={draft.minutes} required onChange={(event) => updateDraft("minutes", event.target.value)} />
              </div>
            </div>
          ) : null}
          <TextAreaField
            label={messages.calendar.blockedReason}
            name="blocked-day-reason"
            placeholder={messages.calendar.blockedReasonPlaceholder}
            value={draft.reason}
            onChange={(event) => updateDraft("reason", event.target.value)}
          />

          {error ? (
            <p role="alert" className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}

          <Button
            icon={<FiCalendar />}
            isLoading={loadingAction === "save"}
            disabled={!canSave}
            className="w-full sm:w-fit"
            onClick={() => void saveDayBlock()}
          >
            {isHourly ? messages.calendar.blockHours : messages.calendar.blockDay}
          </Button>
        </fieldset>

        <div className="grid gap-3">
          {sortedDayBlocks.length > 0 ? sortedDayBlocks.map((dayBlock) => (
            <div
              key={dayBlock.id}
              className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary">{formatDayBlockRange(dayBlock)}{dayBlock.startTime && dayBlock.endTime ? ` · ${dayBlock.startTime}–${dayBlock.endTime}` : ` · ${messages.calendar.blockedFullDay}`}</p>
                {dayBlock.employeeId ? (
                  <p className="mt-1 text-sm font-semibold text-primary">
                    {employeeNames.get(dayBlock.employeeId) ?? messages.calendar.blockedEmployeeUnknown}
                  </p>
                ) : null}
                <p className="mt-1 break-words text-sm text-muted">{dayBlock.reason}</p>
              </div>
              <Button
                size="sm"
                variant="danger"
                icon={<FiTrash2 />}
                isLoading={loadingAction === dayBlock.id}
                disabled={loadingAction !== null}
                onClick={() => void deleteDayBlock(dayBlock.id)}
              >
                {messages.actions.delete}
              </Button>
            </div>
          )) : (
            <p className="rounded-xl border border-dashed border-subtle bg-surface p-4 text-sm text-muted">
              {messages.calendar.blockedDaysEmpty}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function formatDayBlockRange(dayBlock: BusinessDayBlock) {
  if (dayBlock.startsOn === dayBlock.endsOn) {
    return getDateLabel(dayBlock.startsOn);
  }

  return `${getDateLabel(dayBlock.startsOn)} - ${getDateLabel(dayBlock.endsOn)}`;
}

function isValidDateRange(startsOn: string, endsOn: string) {
  return isValidDate(startsOn) && isValidDate(endsOn) && startsOn <= endsOn;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getTomorrowDateValue() {
  const tomorrow = new Date();

  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
