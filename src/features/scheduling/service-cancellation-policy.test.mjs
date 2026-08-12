import test from "node:test";
import assert from "node:assert/strict";

import {
  cancellationLeadDaysToMinutes,
  cancellationLeadMinutesToDays,
  hasValidCancellationLeadMinutes,
  minimumCancellationLeadMinutes,
  normalizeCancellationLeadMinutes
} from "./service-cancellation-policy.ts";

test("cancellationLeadDaysToMinutes stores cancellation lead time in minutes", () => {
  assert.equal(cancellationLeadDaysToMinutes(1), 1440);
  assert.equal(cancellationLeadDaysToMinutes(3), 4320);
});

test("cancellationLeadDaysToMinutes enforces at least one day", () => {
  assert.equal(cancellationLeadDaysToMinutes(0), minimumCancellationLeadMinutes);
  assert.equal(cancellationLeadDaysToMinutes(-2), minimumCancellationLeadMinutes);
});

test("cancellationLeadMinutesToDays renders stored minutes as whole days", () => {
  assert.equal(cancellationLeadMinutesToDays(1440), 1);
  assert.equal(cancellationLeadMinutesToDays(2880), 2);
  assert.equal(cancellationLeadMinutesToDays(1500), 2);
});

test("hasValidCancellationLeadMinutes rejects values below one day", () => {
  assert.equal(hasValidCancellationLeadMinutes(0), false);
  assert.equal(hasValidCancellationLeadMinutes(1439), false);
  assert.equal(hasValidCancellationLeadMinutes(1440), true);
});

test("normalizeCancellationLeadMinutes upgrades legacy values to valid day blocks", () => {
  assert.equal(normalizeCancellationLeadMinutes(0), 1440);
  assert.equal(normalizeCancellationLeadMinutes(1500), 2880);
  assert.equal(normalizeCancellationLeadMinutes(2880), 2880);
});
