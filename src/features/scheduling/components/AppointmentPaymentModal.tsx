import { useState } from "react";
import { FiCheck, FiEdit2, FiX } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { appointmentPaymentNoteMaxLength, isValidAppointmentPaymentAmount } from "@/features/scheduling/appointment-payment";
import type { Messages } from "@/features/scheduling/i18n/messages";

type AppointmentPaymentModalProps = {
  amount: number;
  messages: Messages;
  onClose: () => void;
  onConfirm: (amount: number, paymentNote?: string) => Promise<boolean | void>;
};

export function AppointmentPaymentModal({ amount, messages, onClose, onConfirm }: AppointmentPaymentModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftAmount, setDraftAmount] = useState(String(amount));
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirmPayment() {
    if (isSaving) return;
    const value = Number(draftAmount);
    if (!draftAmount.trim() || !isValidAppointmentPaymentAmount(value)) {
      setError(messages.calendar.paymentAmountInvalid);
      return;
    }
    setError("");
    setIsSaving(true);
    try {
      const saved = await onConfirm(value, value !== amount ? note.trim() : undefined);
      if (saved === false) setError(messages.calendar.paymentSaveFailed);
    } catch {
      setError(messages.calendar.paymentSaveFailed);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen>
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-primary">{messages.calendar.confirmPaymentTitle}</h2>
        <Button size="icon" variant="ghost" aria-label={messages.actions.cancel} disabled={isSaving} onClick={onClose}><FiX /></Button>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{messages.calendar.confirmPaymentHint}</p>
      <div className="mt-5 rounded-xl border border-brand/25 bg-brand-soft p-4">
        {isEditing ? <TextField label={messages.calendar.paymentAmount} type="number" min={0} max={999999999.99} step="0.01" inputMode="decimal" value={draftAmount} disabled={isSaving} onChange={(event) => { setDraftAmount(event.target.value); setError(""); }} /> : <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-semibold text-brand-strong">{messages.calendar.paymentAmount}</p><p className="mt-1 text-2xl font-bold text-primary">{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)}</p></div>
          <Button size="icon" variant="secondary" aria-label={messages.calendar.editPaymentAmount} onClick={() => setIsEditing(true)}><FiEdit2 /></Button>
        </div>}
      </div>
      {isEditing ? <div className="mt-4"><TextAreaField label={messages.calendar.paymentAdditionalInfo} placeholder={messages.calendar.paymentAdditionalInfoHint} maxLength={appointmentPaymentNoteMaxLength} value={note} disabled={isSaving} onChange={(event) => setNote(event.target.value.slice(0, appointmentPaymentNoteMaxLength))} /><p className="mt-1 text-right text-xs text-muted">{note.length}/{appointmentPaymentNoteMaxLength}</p></div> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" disabled={isSaving} onClick={onClose}>{messages.actions.cancel}</Button>
        <Button icon={<FiCheck />} isLoading={isSaving} onClick={() => void confirmPayment()}>{messages.calendar.confirmPayment}</Button>
      </div>
    </Modal>
  );
}
