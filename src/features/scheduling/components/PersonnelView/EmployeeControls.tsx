import { ReactNode, useRef } from "react";
import { FiEdit2, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";

import { cx } from "@/components/ui/utils";
import { EmployeeMenuAction } from "@/features/scheduling/components/PersonnelView/types";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Employee } from "@/features/scheduling/types";

type EmployeeActionsMenuProps = {
  disabled: boolean;
  employee: Employee;
  loadingAction: EmployeeMenuAction | null;
  messages: Messages;
  onArchive: () => Promise<void>;
  onUnarchive: () => Promise<void>;
  onDelete: () => Promise<void>;
};

export function EmployeeActionsMenu({
  disabled,
  employee,
  loadingAction,
  messages,
  onArchive,
  onUnarchive,
  onDelete
}: EmployeeActionsMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const hasLoadingAction = loadingAction !== null;

  async function runAction(action: () => Promise<void>) {
    if (hasLoadingAction) {
      return;
    }

    await action();

    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }

  return (
    <details ref={detailsRef} className="group relative">
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
        {!employee.isArchived ? (
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-danger hover:bg-danger-soft disabled:cursor-wait disabled:opacity-70"
            disabled={hasLoadingAction}
            onClick={() => void runAction(onArchive)}
          >
            <EmployeeMenuActionIcon isLoading={loadingAction === "archive"} icon={<FiTrash2 aria-hidden="true" />} />
            {messages.actions.archive}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-primary hover:bg-shell disabled:cursor-wait disabled:opacity-70"
              disabled={hasLoadingAction}
              onClick={() => void runAction(onUnarchive)}
            >
              <EmployeeMenuActionIcon isLoading={loadingAction === "unarchive"} icon={<FiEdit2 aria-hidden="true" />} />
              {messages.actions.unarchive}
            </button>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-danger hover:bg-danger-soft disabled:cursor-wait disabled:opacity-70"
              disabled={hasLoadingAction}
              onClick={() => void runAction(onDelete)}
            >
              <EmployeeMenuActionIcon isLoading={loadingAction === "delete"} icon={<FiTrash2 aria-hidden="true" />} />
              {messages.actions.delete}
            </button>
          </>
        )}
      </div>
    </details>
  );
}

type EmployeeVisibilitySwitchProps = {
  employee: Employee;
  isDisabled: boolean;
  isLoading: boolean;
  messages: Messages;
  onToggle: () => void;
};

export function EmployeeVisibilitySwitch({
  employee,
  isDisabled,
  isLoading,
  messages,
  onToggle
}: EmployeeVisibilitySwitchProps) {
  const isVisible = employee.isVisible;

  return (
    <button
      type="button"
      role="switch"
      className={cx(
        "inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2 text-[0.68rem] font-bold transition-all",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        isVisible ? "border-success bg-success-soft text-success" : "border-subtle bg-input text-muted",
        isLoading && "animate-pulse",
        isDisabled && "cursor-not-allowed opacity-60"
      )}
      aria-checked={isVisible}
      aria-busy={isLoading}
      disabled={isLoading || isDisabled}
      title={isVisible ? messages.services.visible : messages.services.hidden}
      onClick={onToggle}
    >
      <span
        className={cx(
          "relative h-3.5 w-7 rounded-full transition-colors",
          isVisible ? "bg-success" : "bg-muted"
        )}
        aria-hidden="true"
      >
        <span
          className={cx(
            "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-surface transition-transform",
            isVisible ? "-translate-x-3" : "translate-x-0.5"
          )}
        />
      </span>
      <span className="min-w-10 text-left">
        {isLoading ? messages.services.savingVisibility : isVisible ? messages.services.visible : messages.services.hidden}
      </span>
    </button>
  );
}

function EmployeeMenuActionIcon({ isLoading, icon }: { isLoading: boolean; icon: ReactNode }) {
  return isLoading ? (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
  ) : (
    <span className="grid place-items-center" aria-hidden="true">{icon}</span>
  );
}
