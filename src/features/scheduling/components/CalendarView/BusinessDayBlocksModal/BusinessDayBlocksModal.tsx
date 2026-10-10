import { useState } from "react";
import { FiCalendar, FiTrash2, FiX } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { Messages } from "@/features/scheduling/i18n/messages";
import { BusinessDayBlock, Employee } from "@/features/scheduling/types";
import { DayBlockTab, getVisibleDayBlocksForTab } from "@/features/scheduling/utils/day-blocks";
import { getDateLabel } from "@/features/scheduling/utils/format";

type BusinessDayBlocksModalProps = {
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
  target: "business" | "employee";
};

const defaultDraft: Draft = {
  endsOn: "",
  employeeId: "",
  reason: "",
  startsOn: "",
  target: "business"
};

export function BusinessDayBlocksModal({
  dayBlocks,
  employees,
  isOpen,
  messages,
  onClose,
  onDelete,
  onSave
}: BusinessDayBlocksModalProps) {
  const [draft, setDraft] = useState(defaultDraft);
  const [activeTab, setActiveTab] = useState<DayBlockTab>("business");
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState<"save" | string | null>(null);
  const minimumBlockDate = getTomorrowDateValue();
  const sortedDayBlocks = getVisibleDayBlocksForTab(dayBlocks, activeTab, minimumBlockDate);
  const availableEmployees = employees.filter((employee) => !employee.isArchived);
  const employeeNames = new Map(employees.map((employee) => [employee.id, employee.name]));

  function updateDraft(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function saveDayBlock() {
    const startsOn = draft.startsOn.trim();
    const endsOn = (draft.endsOn.trim() || startsOn);
    const reason = draft.reason.trim() || (draft.target === "employee"
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

    if (draft.target === "employee" && !availableEmployees.some((employee) => employee.id === draft.employeeId)) {
      setError(messages.calendar.blockedEmployeeInvalid);
      return;
    }

    setLoadingAction("save");

    try {
      const didSave = await onSave({
        id: crypto.randomUUID(),
        startsOn,
        endsOn,
        reason,
        employeeId: draft.target === "employee" ? draft.employeeId : null
      });

      if (didSave !== false) {
        setActiveTab(draft.target);
        setDraft((current) => ({ ...current, startsOn: "", endsOn: "", reason: "" }));
      }
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
    <Modal isOpen={isOpen} className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto">
      <div className="grid gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{messages.calendar.blockedDaysEyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold text-primary">{messages.calendar.blockedDays}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{messages.calendar.blockedDaysDescription}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label={messages.actions.closeMenu}
            disabled={loadingAction !== null}
            onClick={onClose}
          >
            <FiX />
          </Button>
        </div>

        <div className="grid gap-4 rounded-xl border border-subtle bg-input p-4">
          <SelectField
            label={messages.calendar.blockedTarget}
            name="blocked-day-target"
            value={draft.target}
            options={[
              { value: "business", label: messages.calendar.blockedBusinessTarget },
              { value: "employee", label: messages.calendar.blockedEmployeeTarget, disabled: availableEmployees.length === 0 }
            ]}
            onChange={(event) => updateDraft("target", event.target.value as Draft["target"])}
          />
          {draft.target === "employee" ? (
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
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={messages.calendar.blockedFrom}
              name="blocked-day-start"
              type="date"
              min={minimumBlockDate}
              value={draft.startsOn}
              required
              onChange={(event) => updateDraft("startsOn", event.target.value)}
            />
            <TextField
              label={messages.calendar.blockedUntil}
              name="blocked-day-end"
              type="date"
              min={draft.startsOn || minimumBlockDate}
              value={draft.endsOn}
              required
              onChange={(event) => updateDraft("endsOn", event.target.value)}
            />
          </div>
          <TextAreaField
            label={messages.calendar.blockedReason}
            name="blocked-day-reason"
            placeholder={messages.calendar.blockedReasonPlaceholder}
            value={draft.reason}
            onChange={(event) => updateDraft("reason", event.target.value)}
          />

          {error ? (
            <p className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger">
              {error}
            </p>
          ) : null}

          <Button
            icon={<FiCalendar />}
            isLoading={loadingAction === "save"}
            disabled={loadingAction !== null}
            className="w-full sm:w-fit"
            onClick={() => void saveDayBlock()}
          >
            {messages.calendar.blockDay}
          </Button>
        </div>

        <div className="grid gap-3">
          <div role="group" aria-label={messages.calendar.blockedDays} className="flex gap-2 border-b border-subtle pb-2">
            <Button
              aria-pressed={activeTab === "business"}
              size="sm"
              variant={activeTab === "business" ? "primary" : "ghost"}
              onClick={() => setActiveTab("business")}
            >
              {messages.calendar.blockedBusinessTab}
            </Button>
            <Button
              aria-pressed={activeTab === "employee"}
              size="sm"
              variant={activeTab === "employee" ? "primary" : "ghost"}
              onClick={() => setActiveTab("employee")}
            >
              {messages.calendar.blockedEmployeeTab}
            </Button>
          </div>
          {sortedDayBlocks.length > 0 ? sortedDayBlocks.map((dayBlock) => (
            <div
              key={dayBlock.id}
              className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary">{formatDayBlockRange(dayBlock)}</p>
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
  return Boolean(startsOn && endsOn && /^\d{4}-\d{2}-\d{2}$/.test(startsOn) && /^\d{4}-\d{2}-\d{2}$/.test(endsOn) && startsOn <= endsOn);
}

function getTomorrowDateValue() {
  const tomorrow = new Date();

  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
