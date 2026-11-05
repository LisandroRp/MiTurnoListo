"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { FiLoader } from "react-icons/fi";

import { cx } from "@/components/ui/utils";

import { AppointmentCard } from "@/features/scheduling/components/CalendarView";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";
import { Messages } from "@/features/scheduling/i18n/messages";
import { loadSchedulingSnapshot } from "@/lib/networking/endpoints/scheduling";

type Props = {
  bookingId: string;
  businessId: string;
  messages: Messages;
  children: ReactNode;
  onModalStateChange: (open: boolean) => void;
  onClosed: (changed: boolean) => void;
};

export function CustomerBookingAction({ bookingId, businessId, messages, children, onModalStateChange, onClosed }: Props) {
  const { deleteAppointment, markAppointmentPaid, markAppointmentNoShow, rescheduleAppointment } = useScheduling();
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadSchedulingSnapshot>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = useRef(true);
  const changed = useRef(false);
  const callbacks = useRef({ onModalStateChange, onClosed });
  useEffect(() => { callbacks.current = { onModalStateChange, onClosed }; }, [onModalStateChange, onClosed]);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);

  const handleModalState = useCallback((open: boolean) => {
    callbacks.current.onModalStateChange(open);
    if (!open) { setSnapshot(null); callbacks.current.onClosed(changed.current); changed.current = false; }
  }, []);

  async function openBooking() {
    if (loading) return;
    changed.current = false;
    setLoading(true);
    setFailed(false);
    try {
      const next = await loadSchedulingSnapshot({ scope: "calendar" });
      if (!active.current) return;
      if (next.businessId !== businessId || !next.appointments.some((item) => item.id === bookingId)) throw new Error("Booking unavailable.");
      callbacks.current.onModalStateChange(true);
      setSnapshot(next);
    } catch {
      if (active.current) setFailed(true);
    } finally {
      if (active.current) setLoading(false);
    }
  }

  async function runBookingMutation(action: () => Promise<boolean>) {
    const saved = await action();
    if (saved) changed.current = true;
    return saved;
  }

  const trigger = (onClick: () => void) => (
    <button type="button" onClick={onClick} disabled={loading} aria-busy={loading}
      className={cx(
        "relative w-full cursor-pointer rounded-lg border p-4 text-left transition-colors hover:border-brand hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-wait",
        loading ? "border-brand bg-brand-soft ring-2 ring-brand/20" : "border-subtle bg-input"
      )}>
      {children}
      {loading ? <span role="status" className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-brand-strong shadow-sm">
          <FiLoader className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        </span>
        <span className="sr-only">{messages.customers.history.loading}</span>
      </span> : null}
    </button>
  );
  const appointment = snapshot?.appointments.find((item) => item.id === bookingId);
  const service = snapshot?.services.find((item) => item.id === appointment?.serviceId);
  const employee = snapshot?.employees.find((item) => item.id === appointment?.employeeId);

  return <>
    {snapshot && appointment ? <AppointmentCard defaultOpen renderTrigger={trigger} onModalStateChange={handleModalState}
      messages={messages} appointment={appointment} service={service} employee={employee}
      serviceName={service?.name} employeeName={employee?.name} employees={snapshot.employees}
      appointments={snapshot.appointments} businessDayBlocks={snapshot.businessDayBlocks}
      onDeleteAppointment={(...args) => runBookingMutation(() => deleteAppointment(...args))}
      onMarkAppointmentPaid={(...args) => runBookingMutation(() => markAppointmentPaid(...args))}
      onMarkAppointmentNoShow={(...args) => runBookingMutation(() => markAppointmentNoShow(...args))}
      onRescheduleAppointment={(...args) => runBookingMutation(() => rescheduleAppointment(...args))} /> : trigger(() => { void openBooking(); })}
    {failed ? <p role="alert" className="mt-2 text-sm text-danger">{messages.customers.history.error}</p> : null}
  </>;
}
