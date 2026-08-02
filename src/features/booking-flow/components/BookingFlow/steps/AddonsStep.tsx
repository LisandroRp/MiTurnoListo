import { Card } from "@/components/ui/Card";
import { Messages } from "@/features/scheduling/i18n/messages";
import { ServiceAddon } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";

export function AddonsStep({
  addons,
  messages,
  selectedAddonIds,
  total,
  onToggleAddon
}: {
  addons: ServiceAddon[];
  messages: Messages;
  selectedAddonIds: string[];
  total: number;
  onToggleAddon: (addonId: string) => void;
}) {
  return (
    <Card className="grid gap-5">
      <div>
        <h2 className="text-2xl font-bold text-primary">{messages.bookingFlow.chooseAddons}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{messages.bookingFlow.chooseAddonsHint}</p>
      </div>

      {addons.length > 0 ? (
        <div className="grid gap-3">
          {addons.map((addon) => {
            const isSelected = selectedAddonIds.includes(addon.id);

            return (
              <label
                key={addon.id}
                className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-subtle bg-input p-4 transition-colors hover:bg-surface-strong"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    className="h-4 w-4 cursor-pointer accent-brand"
                    onChange={() => onToggleAddon(addon.id)}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-primary">{addon.name}</span>
                    <span className="block text-sm text-muted">+ {formatCurrency(addon.price)}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-subtle bg-input p-4 text-sm text-muted">{messages.bookingFlow.noAddonsAvailable}</p>
      )}

      <div className="flex items-center justify-between rounded-xl border border-brand bg-brand-soft p-4">
        <span className="text-sm font-semibold text-muted">{messages.bookingFlow.summary.total}</span>
        <strong className="text-xl font-black text-primary">{formatCurrency(total)}</strong>
      </div>
    </Card>
  );
}
