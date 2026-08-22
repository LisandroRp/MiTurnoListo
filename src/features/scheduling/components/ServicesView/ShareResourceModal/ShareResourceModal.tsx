import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { FiCopy, FiLink, FiMaximize2, FiMinimize2, FiX } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";
import { Messages } from "@/features/scheduling/i18n/messages";

type ShareResourceModalProps = {
  messages: Messages;
  title: string;
  description: string;
  qrAlt: string;
  url: string;
  onClose: () => void;
  onCopy: () => void;
};

export function ShareResourceModal({
  messages,
  title,
  description,
  qrAlt,
  url,
  onClose,
  onCopy
}: ShareResourceModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isQrExpanded, setIsQrExpanded] = useState(false);

  useEffect(() => {
    let isActive = true;

    void QRCode.toDataURL(url, {
      margin: 2,
      width: 360
    }).then((dataUrl) => {
      if (isActive) {
        setQrDataUrl(dataUrl);
      }
    });

    return () => {
      isActive = false;
    };
  }, [url]);

  const qrSizeClass = isQrExpanded ? "h-64 w-64 sm:h-72 sm:w-72" : "h-36 w-36 sm:h-44 sm:w-44";

  return (
    <div className="p-safe fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-primary/35 px-3 py-4 sm:px-6">
      <Card
        role="dialog"
        aria-modal="true"
        className="grid max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-hidden p-0 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-subtle px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{messages.actions.share}</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-primary sm:text-3xl">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          </div>
          <Button size="icon" variant="ghost" aria-label={messages.actions.cancel} onClick={onClose}>
            <FiX />
          </Button>
        </div>

        <div
          className={cx(
            "grid gap-4 overflow-y-auto p-4 sm:p-5","justify-items-center"
          )}
        >
          <div className={cx("grid justify-items-center gap-3 rounded-xl border border-subtle bg-input p-3", isQrExpanded ? "w-fit" : "w-full max-w-xs")}>
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt={qrAlt}
                width={360}
                height={360}
                unoptimized
                className={cx(
                  "rounded-xl border border-subtle bg-surface p-3 shadow-sm transition-all duration-500",
                  qrSizeClass
                )}
              />
            ) : (
              <div className={cx("grid place-items-center rounded-xl border border-subtle bg-surface text-sm text-muted", qrSizeClass)}>
                {messages.services.generatingQr}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={isQrExpanded ? <FiMinimize2 /> : <FiMaximize2 />}
              onClick={() => setIsQrExpanded((current) => !current)}
            >
              {isQrExpanded ? messages.services.shrinkQr : messages.services.expandQr}
            </Button>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-subtle bg-surface px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
          <Button variant="secondary" onClick={onClose}>
            {messages.actions.cancel}
          </Button>
          <Button icon={<FiCopy />} onClick={onCopy}>
            {messages.services.copyPublicLink}
          </Button>
        </div>
      </Card>
    </div>
  );
}
