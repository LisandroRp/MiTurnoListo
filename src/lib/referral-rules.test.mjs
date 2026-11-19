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

test("effective tier distinguishes paid Pro from Infinity referral rewards", () => {
  assert.equal(getEffectiveSubscriptionTier("paid", "free"), "pro");
  assert.equal(getEffectiveSubscriptionTier("referral", "free"), "unlimited");
  assert.equal(getEffectiveSubscriptionTier("free", "free"), "free");
  assert.equal(getEffectiveSubscriptionTier("free", "pro"), "pro");
});


test("an authoritative referral summary preserves Infinity and handles expiry while older summaries retain the current plan", () => {
  assert.equal(getEffectiveSubscriptionTier("manual", "unlimited"), "unlimited");
  assert.equal(getEffectiveSubscriptionTier("paid", "unlimited"), "unlimited");
  assert.equal(getEffectiveSubscriptionTier("manual", "unlimited", "unlimited"), "unlimited");
  assert.equal(getEffectiveSubscriptionTier("free", "unlimited", "free"), "free");
  assert.equal(getEffectiveSubscriptionTier("manual", "unlimited", "pro"), "pro");
});
