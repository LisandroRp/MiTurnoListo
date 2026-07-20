type PlanLimitNotificationInput = {
  businessId: string;
  limit: "monthlyAppointments";
};

export async function notifyPlanLimitReached(_input: PlanLimitNotificationInput) {
  // Email delivery is intentionally a no-op until a transactional provider is configured.
  // When available, wire the provider here so limit enforcement stays server-side.
  return;
}
