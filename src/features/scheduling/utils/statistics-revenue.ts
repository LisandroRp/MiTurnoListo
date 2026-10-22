type RevenueAppointment = { appointmentStatus: string; paymentStatus: string; revenue: number };

export type StatisticsRevenueFilter = "all" | "estimated" | "paid" | "pending";

export function buildStatisticsPaymentBreakdown(appointments: readonly RevenueAppointment[]) {
  const counts = { paid: 0, pending: 0, cancelled: 0, refunded: 0 };
  for (const appointment of appointments) {
    if (appointment.appointmentStatus === "rescheduled") continue;
    if (appointment.paymentStatus === "refunded") counts.refunded += 1;
    else if (appointment.appointmentStatus === "cancelled") counts.cancelled += 1;
    else if (appointment.paymentStatus === "paid") counts.paid += 1;
    else if (appointment.paymentStatus === "pending") counts.pending += 1;
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { counts, total };
}

export function filterStatisticsRevenue<T extends RevenueAppointment>(appointments: readonly T[], filter: StatisticsRevenueFilter): T[] {
  if (filter === "all") return [...appointments];
  return appointments.filter((appointment) => (
    appointment.appointmentStatus !== "cancelled" &&
    appointment.appointmentStatus !== "rescheduled" &&
    appointment.paymentStatus !== "refunded" &&
    (filter === "estimated" || appointment.paymentStatus === filter)
  ));
}

export function buildStatisticsRevenue<T extends RevenueAppointment>(appointments: readonly T[]) {
  const included = filterStatisticsRevenue(appointments, "estimated");
  const paid = filterStatisticsRevenue(included, "paid");
  const pending = filterStatisticsRevenue(included, "pending");
  const capturedRevenue = paid.reduce((sum, appointment) => sum + appointment.revenue, 0);
  const pendingRevenue = pending.reduce((sum, appointment) => sum + appointment.revenue, 0);
  return {
    included, paid, pending, capturedRevenue, pendingRevenue,
    estimatedRevenue: capturedRevenue + pendingRevenue,
    averageTicket: included.length ? (capturedRevenue + pendingRevenue) / included.length : 0
  };
}
