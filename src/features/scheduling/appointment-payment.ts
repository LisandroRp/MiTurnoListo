export const appointmentPaymentNoteMaxLength = 100;

export function isValidAppointmentPaymentAmount(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isFinite(amount) && amount >= 0 && amount <= 999999999.99 && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.00001;
}

export function isValidAppointmentPaymentNote(note: unknown): note is string | undefined {
  return note === undefined || (typeof note === "string" && note.length <= appointmentPaymentNoteMaxLength);
}
