"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FiInfo, FiX } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Customer, CustomerBookingsResponse } from "@/features/scheduling/types";
import { getCustomerBookings } from "@/lib/networking/endpoints/customers";
import { CustomerBookingAction } from "./CustomerBookingAction";
import { LoadingDotsText } from "./LoadingDotsText";

export function CustomerBookingHistoryButton({ customer, messages, onClick }: { customer: Customer; messages: Messages; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="!h-7 !w-7 rounded-full text-brand-strong" onClick={onClick}
      aria-label={messages.customers.history.open.replace("{name}", customer.fullName || customer.email)}>
      <FiInfo aria-hidden="true" />
    </Button>
  );
}

export function CustomerBookingHistory({ businessId, customer, messages, onClose }: {
  businessId: string; customer: Customer; messages: Messages; onClose: () => void;
}) {
  const copy = messages.customers.history;
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<CustomerBookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const nestedModalOpen = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void getCustomerBookings(businessId, customer.id, page, controller.signal).then((response) => {
      if (!controller.signal.aborted) { setResult(response); setFailed(false); }
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [businessId, customer.id, page, attempt]);

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = root.current?.closest('[role="dialog"]');
    dialog?.setAttribute("aria-labelledby", titleId);
    if (!nestedModalOpen.current) root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (nestedModalOpen.current) return;
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const controls = root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("keydown", handleKey); if (!nestedModalOpen.current) trigger?.focus(); };
  }, [onClose, titleId]);

  return (
    <Modal isOpen className="max-w-2xl">
      <div ref={root} className="grid gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="break-words text-xl font-bold text-primary">{copy.title.replace("{name}", customer.fullName || customer.email)}</h2>
            <p className="mt-1 break-words text-sm text-muted">{customer.email}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label={copy.close} onClick={onClose}><FiX aria-hidden="true" /></Button>
        </div>
        {loading ? <p role="status" className="py-8 text-center text-muted"><LoadingDotsText text={copy.loading} /></p>
          : failed && !result ? <div role="alert" className="grid justify-items-center gap-3 py-8"><p className="text-muted">{copy.error}</p><Button variant="secondary" onClick={() => { setLoading(true); setAttempt((value) => value + 1); }}>{copy.retry}</Button></div>
          : !result?.data.length ? <p className="py-8 text-center text-muted">{copy.empty}</p>
          : <>
            {failed ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{copy.error}</span><Button variant="ghost" size="sm" onClick={() => setAttempt((value) => value + 1)}>{copy.retry}</Button>
            </div> : null}
            <ol className="grid gap-3">
              {result.data.map((booking, index) => (
                <li key={booking.id}>
                  {(index === 0 || result.data[index - 1].isUpcoming !== booking.isUpcoming) && <h3 className="mb-2 text-sm font-semibold text-muted">{booking.isUpcoming ? copy.upcoming : copy.past}</h3>}
                  <CustomerBookingAction bookingId={booking.id} businessId={businessId} messages={messages}
                    onModalStateChange={(open) => { nestedModalOpen.current = open; }}
                    onClosed={(changed) => { root.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true }); if (changed) setAttempt((value) => value + 1); }}>
                    <span className="grid gap-2">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <time dateTime={booking.startsAt} className="font-bold text-primary">{formatWeekday(booking.startsAt, result.meta.timeZone)}{" · "}{new Intl.DateTimeFormat("es-AR", { timeZone: result.meta.timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(booking.startsAt))}
                        {" · "}{formatTime(booking.startsAt, result.meta.timeZone)} – {formatTime(booking.endsAt, result.meta.timeZone)}</time>
                      <Badge tone={booking.appointmentStatus === "cancelled" ? "danger" : booking.appointmentStatus === "completed" ? "success" : "brand"}>{messages.appointmentStatuses[booking.appointmentStatus]}</Badge>
                    </span>
                    <span className="break-words font-semibold text-primary">{booking.serviceName || "—"}</span>
                    <span className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-muted">{booking.employeeName || "—"}</span>
                      <Badge tone={booking.paymentStatus === "paid" ? "success" : booking.paymentStatus === "refunded" ? "neutral" : "warning"}>{messages.paymentStatuses[booking.paymentStatus]}</Badge>
                    </span>
                    </span>
                  </CustomerBookingAction>
                </li>
              ))}
            </ol>
            <Pagination currentPage={result.meta.currentPage} totalItems={result.meta.total} pageSize={result.meta.perPage}
              onPageChange={(value) => { setLoading(true); setPage(value); }}
              labels={{ summary: copy.summary, previous: messages.customers.previousPage, next: messages.customers.nextPage, navigation: copy.title.replace("{name}", customer.fullName) }} />
          </>}
      </div>
    </Modal>
  );
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function formatWeekday(value: string, timeZone: string) {
  const weekday = new Intl.DateTimeFormat("es-AR", { timeZone, weekday: "long" }).format(new Date(value));
  return weekday.charAt(0).toLocaleUpperCase("es-AR") + weekday.slice(1);
}
