import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { messages } from "./i18n/messages.ts";
import { getPricedMessages } from "./subscription-pricing.ts";
import { getSubscriptionPrices, getPaidSubscriptionConfig } from "../../lib/subscription-plans.ts";

test("configured checkout prices also populate localized cards, modal headings and upgrade billing notices", () => {
  const previousPro = process.env.MERCADO_PAGO_PRO_PRICE_ARS;
  const previousUnlimited = process.env.MERCADO_PAGO_INFINITY_PRICE_ARS;
  try {
    process.env.MERCADO_PAGO_PRO_PRICE_ARS = "29000";
    process.env.MERCADO_PAGO_INFINITY_PRICE_ARS = "62000";
    const prices = getSubscriptionPrices();
    assert.equal(prices.pro, getPaidSubscriptionConfig("pro").amount);
    assert.equal(prices.unlimited, getPaidSubscriptionConfig("unlimited").amount);
    const es = getPricedMessages(messages.es, prices, "es");
    const en = getPricedMessages(messages.en, prices, "en");
    assert.equal(es.profile.proPlanPrice, "$29.000 / mes");
    assert.equal(es.profile.unlimitedPlanPrice, "$62.000 / mes");
    assert.match(es.profile.infinityUpgradeDescription, /\$62\.000 ARS/);
    assert.equal(en.profile.proPlanPrice, "$29,000 / month");
    assert.match(en.profile.infinityUpgradeDescription, /\$62,000 ARS/);
    assert.equal(messages.es.profile.proPlanPrice, "{price} / mes", "formatting never mutates shared translations");
  } finally {
    if (previousPro === undefined) delete process.env.MERCADO_PAGO_PRO_PRICE_ARS; else process.env.MERCADO_PAGO_PRO_PRICE_ARS = previousPro;
    if (previousUnlimited === undefined) delete process.env.MERCADO_PAGO_INFINITY_PRICE_ARS; else process.env.MERCADO_PAGO_INFINITY_PRICE_ARS = previousUnlimited;
  }
});

test("only numeric public prices cross the server-to-client boundary", () => {
  const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
  const provider = readFileSync(new URL("./components/SchedulingProvider.tsx", import.meta.url), "utf8");
  assert.match(layout, /subscriptionPrices=\{getSubscriptionPrices\(\)\}/);
  assert.match(provider, /getPricedMessages\(messages\[locale\], subscriptionPrices, locale\)/);
  assert.doesNotMatch(provider, /process\.env\.MERCADO_PAGO/);
});
