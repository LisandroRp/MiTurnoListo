import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import ts from "typescript";

const fileUrl = new URL("./plan-limits.ts", import.meta.url);
const require = createRequire(import.meta.url);
const output = ts.transpileModule(readFileSync(fileUrl, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const componentModule = new Module(fileUrl.pathname);
componentModule.filename = fileUrl.pathname;
componentModule.require = require;
componentModule._compile(output, fileUrl.pathname);

const { canUseFreePlanSlot, freePlanLimits, getFreePlanIncludedIds, getMonthlyAppointmentUsage, hasReachedFreeMonthlyAppointmentLimit } = componentModule.exports;

test("Free plan permits one active employee, two visible services, and fifteen monthly appointments", () => {
  assert.deepEqual(freePlanLimits, {
    monthlyAppointments: 15,
    activeEmployees: 1,
    visibleServices: 2
  });
});

test("existing excess records are selected consistently regardless of response order", () => {
  const records = [
    { id: "z", name: "Zeta" },
    { id: "a", name: "Alfa" },
    { id: "b", name: "Beta" }
  ];

  assert.deepEqual([...getFreePlanIncludedIds(records, 1)], ["a"]);
  assert.deepEqual([...getFreePlanIncludedIds([...records].reverse(), 2)], ["a", "b"]);
  assert.deepEqual([...getFreePlanIncludedIds([
    { id: "second", name: "Same" },
    { id: "first", name: "Same" }
  ], 1)], ["first"]);
  assert.deepEqual(records.map((record) => record.id), ["z", "a", "b"]);
});

test("existing included records remain editable while extra records and new records are blocked", () => {
  const records = [
    { id: "b", name: "Beta" },
    { id: "a", name: "Alfa" }
  ];

  assert.equal(canUseFreePlanSlot(records, "a", 1), true);
  assert.equal(canUseFreePlanSlot(records, "b", 1), false);
  assert.equal(canUseFreePlanSlot(records, "new", 1), false);
  assert.equal(canUseFreePlanSlot(records.slice(0, 1), "new", 2), true);
  assert.equal(canUseFreePlanSlot([], "new", 1), true);
});

test("monthly usage excludes cancelled and rescheduled appointments", () => {
  const referenceDate = new Date(2026, 9, 20);
  const appointments = [
    { date: "2026-10-01", appointmentStatus: "scheduled" },
    { date: "2026-10-15", appointmentStatus: "cancelled" },
    { date: "2026-10-16", appointmentStatus: "rescheduled" },
    { date: "2026-09-30", appointmentStatus: "scheduled" },
    { date: "2026-10-19", status: "cancelled" }
  ];

  assert.equal(getMonthlyAppointmentUsage(appointments, referenceDate), 1);
});

test("the monthly warning and booking block begin with the fifteenth appointment", () => {
  assert.equal(hasReachedFreeMonthlyAppointmentLimit(14), false);
  assert.equal(hasReachedFreeMonthlyAppointmentLimit(15), true);
  assert.equal(hasReachedFreeMonthlyAppointmentLimit(16), true);
});
