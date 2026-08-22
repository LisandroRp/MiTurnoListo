import { useState } from "react";
import { FiCalendar, FiTrash2, FiX } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { Messages } from "@/features/scheduling/i18n/messages";
import { BusinessDayBlock } from "@/features/scheduling/types";
import { getDateLabel } from "@/features/scheduling/utils/format";

type BusinessDayBlocksModalProps = {
  dayBlocks: BusinessDayBlock[];
  isOpen: boolean;
  messages: Messages;
  onClose: () => void;
  onDelete: (dayBlockId: string) => Promise<boolean> | void;
  onSave: (dayBlock: BusinessDayBlock) => Promise<boolean> | void;
};

type Draft = {
  endsOn: string;
  reason: string;
  startsOn: string;
};

const defaultDraft: Draft = {
  endsOn: "",
  reason: "",
  startsOn: ""
};

export function BusinessDayBlocksModal({
  dayBlocks,
  isOpen,
  messages,
  onClose,
  onDelete,
  onSave
}: BusinessDayBlocksModalProps) {
  const [draft, setDraft] = useState(defaultDraft);
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState<"save" | string | null>(null);
  const sortedDayBlocks = [...dayBlocks].sort((left, right) => left.startsOn.localeCompare(right.startsOn));

  function updateDraft(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function saveDayBlock() {
    const startsOn = draft.startsOn.trim();
    const endsOn = (draft.endsOn.trim() || startsOn);
    const reason = draft.reason.trim() || messages.calendar.blockedDayDefaultReason;

    if (!isValidDateRange(startsOn, endsOn)) {
      setError(messages.calendar.blockedDayInvalid);
      return;
    }

    setLoadingAction("save");

    try {
      const didSave = await onSave({
        id: crypto.randomUUID(),
        startsOn,
        endsOn,
        reason
      });

      if (didSave !== false) {
        setDraft(defaultDraft);
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
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={messages.calendar.blockedFrom}
              name="blocked-day-start"
              type="date"
              value={draft.startsOn}
              required
              onChange={(event) => updateDraft("startsOn", event.target.value)}
            />
            <TextField
              label={messages.calendar.blockedUntil}
              name="blocked-day-end"
              type="date"
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
          {sortedDayBlocks.length > 0 ? sortedDayBlocks.map((dayBlock) => (
            <div
              key={dayBlock.id}
              className="flex flex-col gap-3 rounded-xl border border-subtle bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-primary">{formatDayBlockRange(dayBlock)}</p>
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
