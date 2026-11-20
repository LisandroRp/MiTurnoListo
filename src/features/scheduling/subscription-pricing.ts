import type { Messages } from "@/features/scheduling/i18n/messages";
import type { SubscriptionPrices } from "@/lib/subscription-plans";

export function formatSubscriptionPrice(amount: number, locale: string) {
  return `$${new Intl.NumberFormat(locale.startsWith("es") ? "es-AR" : "en-US", {
    minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(amount)}`;
}

export function getPricedMessages(messages: Messages, prices: SubscriptionPrices, locale: string): Messages {
  const pro = formatSubscriptionPrice(prices.pro, locale);
  const unlimited = formatSubscriptionPrice(prices.unlimited, locale);
  return {
    ...messages,
    profile: {
      ...messages.profile,
      proPlanPrice: messages.profile.proPlanPrice.replace("{price}", pro),
      unlimitedPlanPrice: messages.profile.unlimitedPlanPrice.replace("{price}", unlimited),
      infinityUpgradeDescription: messages.profile.infinityUpgradeDescription.replace("{price}", unlimited)
    }
  };
}
