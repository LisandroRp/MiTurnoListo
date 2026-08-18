import { MouseEvent } from "react";
import { FiCopy } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Messages } from "@/features/scheduling/i18n/messages";

export function TransferPaymentRow({
  label,
  value,
  copyLabel,
  onCopy
}: {
  label: string;
  value: string;
  copyLabel?: string;
  onCopy?: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-subtle bg-surface px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-[0.68rem] font-semibold uppercase text-muted">{label}</p>
        <p className="mt-0.5 break-all text-sm font-bold text-primary">{value}</p>
      </div>
      {onCopy ? (
        <Button variant="secondary" size="sm" icon={<FiCopy />} onClick={onCopy} disabled={!value}>
          {copyLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function ReceiptWhatsappNotice({
  messages,
  href,
  onClick
}: {
  messages: Messages;
  href: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <div className="rounded-lg border border-subtle bg-surface px-3 py-2 leading-5 text-muted">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={onClick}
        className="font-bold !text-brand-hover underline-offset-3 hover:!underline"
      >
        {messages.bookingFlow.transferReceiptWhatsappAction}
      </a>
      <p className="mt-1 text-xs">{messages.bookingFlow.transferReceiptWhatsappHint}</p>
    </div>
  );
}
