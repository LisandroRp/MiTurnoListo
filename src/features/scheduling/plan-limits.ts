export const freePlanLimits = {
  monthlyAppointments: 15,
  activeEmployees: 1,
  visibleServices: 2
} as const;

export function getFreePlanIncludedIds<T extends { id: string; name: string }>(items: readonly T[], limit: number) {
  return new Set(
    [...items]
      .sort((left, right) => left.name.localeCompare(right.name, "es") || left.id.localeCompare(right.id))
      .slice(0, limit)
      .map((item) => item.id)
  );
}

export function canUseFreePlanSlot<T extends { id: string; name: string }>(items: readonly T[], candidateId: string, limit: number) {
  return items.length < limit || getFreePlanIncludedIds(items, limit).has(candidateId);
}

export function isFreePlan(subscriptionTier: string) {
  return subscriptionTier === "free";
}

export function hasReachedFreeMonthlyAppointmentLimit(usage: number) {
  return usage >= freePlanLimits.monthlyAppointments;
}

export function getCurrentMonthRange(referenceDate = new Date()) {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1));

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

export function getMonthlyAppointmentUsage(appointments: { appointmentStatus?: string; date: string; status?: string }[], referenceDate = new Date()) {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();

  return appointments.filter((appointment) => {
    if (
      appointment.appointmentStatus === "cancelled" ||
      appointment.appointmentStatus === "rescheduled" ||
      appointment.status === "cancelled"
    ) {
      return false;
    }

    const appointmentDate = new Date(`${appointment.date}T12:00:00`);

    return appointmentDate.getFullYear() === currentYear && appointmentDate.getMonth() === currentMonth;
  }).length;
}
