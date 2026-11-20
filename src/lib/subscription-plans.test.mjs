import test from "node:test";
import assert from "node:assert/strict";
import { getHighestSubscriptionTier, getPaidSubscriptionConfig, isPaidSubscriptionTier } from "./subscription-plans.ts";
import { getEffectiveSubscriptionTier } from "./referral-rules.ts";
import { buildSubscriptionExternalReference, getSubscriptionPlanFromReference, mapMercadoPagoStatusToTier } from "./mercadopago/subscription-status.ts";

test("monthly prices come from server configuration for the selected plan", () => {
  const previousPro = process.env.MERCADO_PAGO_PRO_PRICE_ARS;
  const previousUnlimited = process.env.MERCADO_PAGO_INFINITY_PRICE_ARS;
  try {
    process.env.MERCADO_PAGO_PRO_PRICE_ARS = "25000";
    process.env.MERCADO_PAGO_INFINITY_PRICE_ARS = "55000";
    assert.deepEqual(getPaidSubscriptionConfig("pro"), { amount: 25000, planCode: "miturnolisto-pro", reason: "MiTurnoListo PRO" });
    assert.deepEqual(getPaidSubscriptionConfig("unlimited"), { amount: 55000, planCode: "miturnolisto-unlimited", reason: "MiTurnoListo INFINITY" });
    process.env.MERCADO_PAGO_INFINITY_PRICE_ARS = "NaN";
    assert.throws(() => getPaidSubscriptionConfig("unlimited"), /MERCADO_PAGO_INFINITY_PRICE_ARS/);
    process.env.MERCADO_PAGO_INFINITY_PRICE_ARS = "-1";
    assert.throws(() => getPaidSubscriptionConfig("unlimited"));
  } finally {
    if (previousPro === undefined) delete process.env.MERCADO_PAGO_PRO_PRICE_ARS; else process.env.MERCADO_PAGO_PRO_PRICE_ARS = previousPro;
    if (previousUnlimited === undefined) delete process.env.MERCADO_PAGO_INFINITY_PRICE_ARS; else process.env.MERCADO_PAGO_INFINITY_PRICE_ARS = previousUnlimited;
  }
});

test("entitlement precedence and referral mapping retain Unlimited", () => {
  assert.equal(isPaidSubscriptionTier("unlimited"), true);
  assert.equal(isPaidSubscriptionTier("free"), false);
  assert.equal(getHighestSubscriptionTier([null, "free", "pro", "unlimited"]), "unlimited");
  assert.equal(getHighestSubscriptionTier(["unknown", null]), "free");
  for (const source of ["free", "paid", "referral"]) assert.equal(getEffectiveSubscriptionTier(source, "unlimited"), "unlimited");
});

test("provider references carry the chosen plan while legacy references remain Pro", () => {
  const reference = buildSubscriptionExternalReference("business", "owner", "intent", "unlimited");
  assert.equal(getSubscriptionPlanFromReference(reference), "unlimited");
  assert.equal(getSubscriptionPlanFromReference("mtl|b:business|u:owner|i:intent"), "pro");
  assert.throws(() => getSubscriptionPlanFromReference("mtl|b:business|p:unknown"));
  assert.equal(mapMercadoPagoStatusToTier("authorized", "unlimited"), "unlimited");
  for (const status of ["pending", "cancelled", "paused", "unknown"]) assert.equal(mapMercadoPagoStatusToTier(status, "unlimited"), "free");
});

test("INFINITY configuration takes precedence over the legacy variable and retains a deployment fallback", () => {
  const current = process.env.MERCADO_PAGO_INFINITY_PRICE_ARS;
  const legacy = process.env.MERCADO_PAGO_UNLIMITED_PRICE_ARS;
  try {
    process.env.MERCADO_PAGO_INFINITY_PRICE_ARS = "62000";
    process.env.MERCADO_PAGO_UNLIMITED_PRICE_ARS = "58000";
    assert.equal(getPaidSubscriptionConfig("unlimited").amount, 62000);
    delete process.env.MERCADO_PAGO_INFINITY_PRICE_ARS;
    assert.equal(getPaidSubscriptionConfig("unlimited").amount, 58000);
    delete process.env.MERCADO_PAGO_UNLIMITED_PRICE_ARS;
    assert.equal(getPaidSubscriptionConfig("unlimited").amount, 55000);
  } finally {
    if (current === undefined) delete process.env.MERCADO_PAGO_INFINITY_PRICE_ARS; else process.env.MERCADO_PAGO_INFINITY_PRICE_ARS = current;
    if (legacy === undefined) delete process.env.MERCADO_PAGO_UNLIMITED_PRICE_ARS; else process.env.MERCADO_PAGO_UNLIMITED_PRICE_ARS = legacy;
  }
});
