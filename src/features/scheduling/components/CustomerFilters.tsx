import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { Messages } from "@/features/scheduling/i18n/messages";
import { CustomerSortOption, CustomerTagFilter } from "@/features/scheduling/utils/customer-list";

type CustomerFiltersProps = {
  canClear: boolean;
  dateFrom: string;
  dateTo: string;
  messages: Messages;
  sort: CustomerSortOption;
  tag: CustomerTagFilter;
  onClear: () => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSortChange: (value: CustomerSortOption) => void;
  onTagChange: (value: CustomerTagFilter) => void;
};

export function CustomerFilters({
  canClear,
  dateFrom,
  dateTo,
  messages,
  sort,
  tag,
  onClear,
  onDateFromChange,
  onDateToChange,
  onSortChange,
  onTagChange
}: CustomerFiltersProps) {
  const tags: CustomerTagFilter[] = ["all", "active", "atRisk", "frequent", "new", "vip"];
  const sorts: CustomerSortOption[] = ["lastBookingDesc", "lastBookingAsc", "mostSpent", "mostBookings"];

  return (
    <div className="grid gap-3 rounded-2xl border border-subtle bg-surface p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
      <SelectField
        label={messages.customers.sortBy}
        name="customers-sort"
        value={sort}
        options={sorts.map((value) => ({ value, label: messages.customers.sortOptions[value] }))}
        onChange={(event) => onSortChange(event.target.value as CustomerSortOption)}
      />
      <SelectField
        label={messages.customers.tagFilter}
        name="customers-tag"
        value={tag}
        options={tags.map((value) => ({ value, label: value === "all" ? messages.customers.allTags : messages.customers.tags[value] }))}
        onChange={(event) => onTagChange(event.target.value as CustomerTagFilter)}
      />
      <TextField
        label={messages.customers.dateFrom}
        name="customers-date-from"
        type="date"
        value={dateFrom}
        max={dateTo || undefined}
        onChange={(event) => onDateFromChange(event.target.value)}
      />
      <TextField
        label={messages.customers.dateTo}
        name="customers-date-to"
        type="date"
        value={dateTo}
        min={dateFrom || undefined}
        onChange={(event) => onDateToChange(event.target.value)}
      />
      <Button type="button" variant="secondary" className="h-11 whitespace-nowrap sm:col-span-2 xl:col-span-1" disabled={!canClear} onClick={onClear}>
        {messages.customers.clearFilters}
      </Button>
    </div>
  );
}
