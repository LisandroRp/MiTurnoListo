import test from "node:test";
import assert from "node:assert/strict";

import {
  getEffectiveSubscriptionTier,
  normalizeReferralCode
} from "./referral-rules.ts";

test("normalizeReferralCode keeps referral codes URL-safe and uppercase", () => {
  assert.equal(normalizeReferralCode(" lisandro-123 "), "LISANDRO123");
  assert.equal(normalizeReferralCode("ana.lopez_2026"), "ANALOPEZ2026");
});

test("getEffectiveSubscriptionTier enables Pro for paid and referral access", () => {
  assert.equal(getEffectiveSubscriptionTier("paid", "free"), "pro");
  assert.equal(getEffectiveSubscriptionTier("referral", "free"), "pro");
  assert.equal(getEffectiveSubscriptionTier("free", "free"), "free");
  assert.equal(getEffectiveSubscriptionTier("free", "pro"), "pro");
});
