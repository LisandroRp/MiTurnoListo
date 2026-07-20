export const freePlanLimits = {
  monthlyAppointments: 15,
  activeEmployees: 2,
  visibleServices: 5
} as const;

export function isFreePlan(subscriptionTier: string) {
  return subscriptionTier === "free";
}

export function getCurrentMonthRange(referenceDate = new Date()) {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1));

  return {
    start: start.toISOString(),
    end: end.toISOString()
  };
}

export function getMonthlyAppointmentUsage(appointments: { date: string }[], referenceDate = new Date()) {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth();

  return appointments.filter((appointment) => {
    const appointmentDate = new Date(`${appointment.date}T12:00:00`);

    return appointmentDate.getFullYear() === currentYear && appointmentDate.getMonth() === currentMonth;
  }).length;
}
