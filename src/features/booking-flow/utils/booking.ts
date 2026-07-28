import {
  Appointment,
  BookingCustomer,
  BusinessPaymentSettings,
  Employee,
  PaymentMethod,
  Service,
  TimeRange
} from "@/features/scheduling/types";
import { BookingPaymentOption, BookingSlot } from "@/features/booking-flow/types";

const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export function getAvailablePaymentOptions(
  service: Service,
  paymentSettings: BusinessPaymentSettings
): BookingPaymentOption[] {
  const options: BookingPaymentOption[] = [];
  const hasMercadoPago = paymentSettings.mercadoPago.isConfigured;
  const hasTransfer = Boolean(
    paymentSettings.transfers.accountHolder.trim() &&
    paymentSettings.transfers.cbu.trim() &&
    paymentSettings.transfers.alias.trim()
  );

  if (service.paymentMethod === "transfer") {
    return hasTransfer ? ["transfer"] : [];
  }

  if (service.paymentMethod === "card") {
    return hasMercadoPago ? ["mercadoPago"] : [];
  }

  if (service.paymentMethod === "cash") {
    return ["cash"];
  }

  if (hasTransfer) {
    options.push("transfer");
  }

  if (hasMercadoPago) {
    options.push("mercadoPago");
  }

  options.push("cash");
  return options;
}

export function mapPaymentOptionToMethod(option: BookingPaymentOption): Exclude<PaymentMethod, "mixed"> {
  if (option === "transfer") {
    return "transfer";
  }

  if (option === "mercadoPago") {
    return "card";
  }

  return "cash";
}

export function getAvailableSlotsForEmployee(
  service: Service,
  employee: Employee,
  appointments: Appointment[],
  monthDate: Date,
  partySize: number,
  now = new Date()
): BookingSlot[] {
  const slots: BookingSlot[] = [];
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day, 12);
    const dayKey = getDayKey(date);
    const serviceRanges = service.schedule[dayKey];
    const employeeRanges = employee.schedule[dayKey];

    if (!serviceRanges.length || !employeeRanges.length) {
      continue;
    }

    const dateKey = toDateKey(date);
    const overlappingRanges = getOverlappingRanges(serviceRanges, employeeRanges);

    overlappingRanges.forEach((range) => {
      const slotStarts = buildSlotStarts(range.start, range.end, service.durationMinutes);

      slotStarts.forEach((startTime) => {
        const endTime = addMinutes(startTime, service.durationMinutes);
        const slotDateTime = new Date(`${dateKey}T${startTime}:00`);
        const limitDate = new Date(now.getTime() + service.reservationLeadMinutes * 60 * 1000);

        if (slotDateTime < limitDate) {
          return;
        }

        const reserved = appointments
          .filter((appointment) => (
            appointment.status !== "cancelled" &&
            appointment.employeeId === employee.id &&
            appointment.date === dateKey &&
            rangesOverlap(startTime, endTime, appointment.startTime, appointment.endTime)
          ))
          .reduce((total, appointment) => total + appointment.partySize, 0);

        const remainingCapacity = service.capacity - reserved;

        if (remainingCapacity >= partySize) {
          slots.push({ date: dateKey, startTime, endTime, remainingCapacity });
        }
      });
    });
  }

  return dedupeSlots(slots);
}

export function getMonthGrid(monthDate: Date) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOffset = (start.getDay() + 6) % 7;
  const gridStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1 - startOffset, 12);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatMonthLabel(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatLongDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date(`${date}T12:00:00`));
}

export function buildAppointmentId() {
  return `apt-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyCustomer(): BookingCustomer {
  return {
    fullName: "",
    phone: "",
    email: ""
  };
}

function getDayKey(date: Date) {
  return dayKeys[date.getDay()];
}

function getOverlappingRanges(serviceRanges: TimeRange[], employeeRanges: TimeRange[]) {
  const overlaps: TimeRange[] = [];

  serviceRanges.forEach((serviceRange) => {
    employeeRanges.forEach((employeeRange) => {
      const start = maxTime(serviceRange.start, employeeRange.start);
      const end = minTime(serviceRange.end, employeeRange.end);

      if (toMinutes(end) > toMinutes(start)) {
        overlaps.push({ id: `${serviceRange.id}-${employeeRange.id}`, start, end });
      }
    });
  });

  return overlaps;
}

function buildSlotStarts(start: string, end: string, durationMinutes: number) {
  const starts: string[] = [];
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  for (let minutes = startMinutes; minutes + durationMinutes <= endMinutes; minutes += durationMinutes) {
    starts.push(fromMinutes(minutes));
  }

  return starts;
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function fromMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function addMinutes(time: string, minutesToAdd: number) {
  return fromMinutes(toMinutes(time) + minutesToAdd);
}

function maxTime(first: string, second: string) {
  return toMinutes(first) >= toMinutes(second) ? first : second;
}

function minTime(first: string, second: string) {
  return toMinutes(first) <= toMinutes(second) ? first : second;
}

function dedupeSlots(slots: BookingSlot[]) {
  const seen = new Set<string>();

  return slots.filter((slot) => {
    const key = `${slot.date}-${slot.startTime}-${slot.endTime}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}
