import { FiSearch, FiUserX } from "react-icons/fi";

import { cx } from "@/components/ui/utils";
import { Messages } from "@/features/scheduling/i18n/messages";
import { PersonnelFilter } from "@/features/scheduling/components/PersonnelView/types";

type PersonnelFiltersProps = {
  filter: PersonnelFilter;
  messages: Messages;
  searchTerm: string;
  showArchived: boolean;
  onArchivedToggle: () => void;
  onFilterChange: (filter: PersonnelFilter) => void;
  onSearchChange: (value: string) => void;
};

export function PersonnelFilters({
  filter,
  messages,
  searchTerm,
  showArchived,
  onArchivedToggle,
  onFilterChange,
  onSearchChange
}: PersonnelFiltersProps) {
  const filterOptions: Array<{ label: string; value: PersonnelFilter }> = [
    { value: "all", label: messages.personnel.allFilter },
    { value: "visible", label: messages.services.visible },
    { value: "hidden", label: messages.services.hidden }
  ];

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="flex w-full flex-col gap-3 md:flex-row md:items-center">
        <label className="relative w-full md:max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={messages.personnel.searchPlaceholder}
            className="h-11 w-full rounded-xl border border-subtle bg-input px-4 pl-10 text-sm text-primary shadow-sm outline-none transition placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-focus"
          />
        </label>

        <div className="flex w-full flex-row justify-between gap-3">
          <div className="flex w-fit rounded-xl border border-subtle bg-surface p-1 shadow-sm">
            {filterOptions.map((option) => {
              const isSelected = !showArchived && filter === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  className={cx(
                    "cursor-pointer rounded-lg px-4 py-2 text-sm font-bold transition-colors",
                    isSelected ? "bg-brand-soft text-on-brand" : "text-muted hover:bg-surface-strong hover:text-primary"
                  )}
                  onClick={() => onFilterChange(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className={cx(
              "grid h-11 w-11 cursor-pointer place-items-center rounded-xl border border-subtle bg-surface text-muted shadow-sm transition-colors hover:bg-surface-strong hover:text-primary",
              showArchived && "border-brand !bg-brand-soft text-on-brand hover:bg-brand-hover hover:text-on-brand"
            )}
            aria-pressed={showArchived}
            aria-label={messages.personnel.archivedFilter}
            title={messages.personnel.archivedFilter}
            onClick={onArchivedToggle}
          >
            <FiUserX aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
