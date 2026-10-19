import test from "node:test";
import assert from "node:assert/strict";

import {
  cancellationLeadMinutesToValue,
  cancellationLeadValueToMinutes,
  defaultCancellationLeadMinutes,
  formatCancellationLeadTime,
  formatCancellationPolicy,
  getCancellationDeadline,
  getCancellationLeadUnit,
  hasValidCancellationLeadMinutes,
  normalizeCancellationLeadMinutes
} from "./service-cancellation-policy.ts";
import { messages } from "./i18n/messages.ts";

test("new services default to one day of cancellation notice", () => {
  assert.equal(defaultCancellationLeadMinutes, 1440);
});

test("whole hours and days convert to stored minutes, including zero", () => {
  assert.equal(cancellationLeadValueToMinutes(0, "days"), 0);
  assert.equal(cancellationLeadValueToMinutes(1, "hours"), 60);
  assert.equal(cancellationLeadValueToMinutes(23, "hours"), 1380);
  assert.equal(cancellationLeadValueToMinutes(2, "days"), 2880);
  assert.equal(cancellationLeadMinutesToValue(1440, "hours"), 24);
  assert.equal(cancellationLeadMinutesToValue(1380, "days"), 1);
  assert.equal(getCancellationLeadUnit(0), "days");
  assert.equal(getCancellationLeadUnit(1380), "hours");
  assert.equal(getCancellationLeadUnit(1440), "days");
});

test("policy accepts zero and whole hours but rejects fractional hours", () => {
  assert.equal(hasValidCancellationLeadMinutes(0), true);
  assert.equal(hasValidCancellationLeadMinutes(60), true);
  assert.equal(hasValidCancellationLeadMinutes(1380), true);
  assert.equal(hasValidCancellationLeadMinutes(1440), true);
  assert.equal(hasValidCancellationLeadMinutes(30), false);
  assert.equal(hasValidCancellationLeadMinutes(-60), false);
  assert.equal(hasValidCancellationLeadMinutes(60.5), false);
});

test("legacy minute values round up to an hour without replacing zero", () => {
  assert.equal(normalizeCancellationLeadMinutes(0), 0);
  assert.equal(normalizeCancellationLeadMinutes(90), 120);
  assert.equal(normalizeCancellationLeadMinutes(1500), 1500);
});

test("zero closes cancellation when the appointment starts", () => {
  const startsAt = new Date("2026-10-20T15:00:00.000Z");
  assert.equal(getCancellationDeadline(startsAt, 0).toISOString(), startsAt.toISOString());
  assert.equal(getCancellationDeadline(startsAt, 60).toISOString(), "2026-10-20T14:00:00.000Z");
});

test("customer-facing policy describes zero, hours and days accurately", () => {
  assert.equal(formatCancellationLeadTime(0, messages.es), "Sin anticipación");
  assert.equal(formatCancellationPolicy(0, messages.es), "Podés cancelar hasta el inicio del turno.");
  assert.equal(formatCancellationPolicy(60, messages.es), "Podés cancelar hasta 1 hora antes del turno.");
  assert.equal(formatCancellationPolicy(120, messages.es), "Podés cancelar hasta 2 horas antes del turno.");
  assert.equal(formatCancellationPolicy(1440, messages.es), "Podés cancelar hasta 1 día antes del turno.");
  assert.equal(formatCancellationPolicy(2880, messages.es), "Podés cancelar hasta 2 días antes del turno.");
  assert.equal(formatCancellationPolicy(0, messages.en), "You can cancel until the appointment starts.");
  assert.equal(formatCancellationPolicy(60, messages.en), "You can cancel up to 1 hour before the appointment.");
});
