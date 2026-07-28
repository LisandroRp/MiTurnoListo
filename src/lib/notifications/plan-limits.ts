import { sendPlanLimitReachedEmail } from "@/lib/email/booking-emails";

type PlanLimitNotificationInput = {
  businessId: string;
  limit: "monthlyAppointments";
};

export async function notifyPlanLimitReached(input: PlanLimitNotificationInput) {
  if (input.limit === "monthlyAppointments") {
    await sendPlanLimitReachedEmail({ businessId: input.businessId });
  }
}
