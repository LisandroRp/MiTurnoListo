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
    <div className="grid gap-2 rounded-xl border border-subtle bg-surface p-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-muted">{label}</p>
        <p className="mt-1 break-all text-base font-bold text-primary">{value}</p>
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
    <div className="rounded-xl border border-subtle bg-surface p-3 leading-6 text-muted">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={onClick}
        className="font-bold !text-brand-hover underline underline-offset-4"
      >
        {messages.bookingFlow.transferReceiptWhatsappAction}
      </a>
      <p className="mt-1 text-sm">{messages.bookingFlow.transferReceiptWhatsappHint}</p>
    </div>
  );
}
