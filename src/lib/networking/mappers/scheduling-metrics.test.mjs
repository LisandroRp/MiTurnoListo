import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as format from "../../../features/scheduling/utils/format.ts";
import * as revenue from "../../../features/scheduling/utils/statistics-revenue.ts";
import * as assets from "../utils/assets.ts";
import * as dateTime from "../utils/date-time.ts";
import * as referrals from "../../referral-rules.ts";

const require = createRequire(import.meta.url);
const url = new URL("./scheduling.ts", import.meta.url);
const loaded = new Module(url.pathname);
loaded.filename = url.pathname;
const modules = {
  "@/features/scheduling/utils/format": format,
  "@/features/scheduling/utils/statistics-revenue": revenue,
  "@/lib/networking/utils/assets": assets,
  "@/lib/networking/utils/date-time": dateTime,
  "@/lib/referral-rules": referrals
};
loaded.require = (name) => modules[name] ?? require(name);
loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, url.pathname);
const { buildDashboardMetrics } = loaded.exports;

test("employee mapping preserves persisted colors across reloads, subsets and different sort orders", () => {
  const rows = [
    { id: "one", name: "One", color_token: "employee-violet" },
    { id: "two", name: "Two", color_token: "employee-green" },
    { id: "three", name: "Three", color_token: "employee-blue" }
  ];
  const colors = (employees) => Object.fromEntries(employees.map((employee) => [employee.id, employee.color]));
  const first = colors(loaded.exports.mapEmployees(rows, []));
  assert.deepEqual(first, { one: "employee-violet", two: "employee-green", three: "employee-blue" });
  assert.deepEqual(colors(loaded.exports.mapEmployees([...rows].reverse(), [])), first);
  assert.deepEqual(colors(loaded.exports.mapEmployees(rows, [])), first);
  assert.equal(loaded.exports.mapEmployees([rows[1]], [])[0].color, first.two);
});

function appointment(date, paymentStatus, amount, appointmentStatus = "scheduled") {
  return { date, paymentStatus, revenue: amount, appointmentStatus };
}

test("dashboard separates collected and pending revenue using the same exclusions as Statistics", () => {
  const appointments = [
    appointment("2026-10-22", "paid", 200),
    appointment("2026-10-22", "pending", 300),
    appointment("2026-10-22", "paid", 50, "completed"),
    appointment("2026-10-22", "pending", 70, "no_show"),
    appointment("2026-10-22", "paid", 1000, "cancelled"),
    appointment("2026-10-22", "pending", 500, "cancelled"),
    appointment("2026-10-22", "paid", 500, "rescheduled"),
    appointment("2026-10-22", "refunded", 1000, "completed"),
    appointment("2026-09-22", "paid", 100),
    appointment("2026-09-22", "pending", 400)
  ];
  const metrics = buildDashboardMetrics(appointments, "2026-10-22");
  assert.deepEqual(metrics.map((metric) => metric.labelKey), ["collectedRevenue", "pendingRevenue", "bookedAppointments", "cancelledAppointments"]);
  assert.equal(metrics[0].value, format.formatCurrency(250));
  assert.equal(metrics[1].value, format.formatCurrency(370));
  assert.equal(metrics[0].trendValue, 150);
  assert.equal(metrics[1].trendValue, -30);
  assert.equal(metrics[0].trendTone, "success");
  assert.equal(metrics[1].trendTone, "success");
  const summary = revenue.buildStatisticsRevenue(appointments.filter((item) => item.date.startsWith("2026-10")));
  assert.equal(summary.estimatedRevenue, 250 + 370);
});

test("month comparisons handle month ends and year boundaries", () => {
  for (const [reference, previous] of [["2026-03-31", "2026-02-28"], ["2026-01-31", "2025-12-31"]]) {
    const metrics = buildDashboardMetrics([appointment(reference, "paid", 50), appointment(previous, "paid", 200)], reference);
    assert.equal(metrics[0].value, format.formatCurrency(50));
    assert.equal(metrics[0].trendValue, -150);
  }
});

test("empty months show zero revenue and increasing pending amounts use a warning trend", () => {
  const empty = buildDashboardMetrics([], "2026-10-22");
  assert.equal(empty[0].value, format.formatCurrency(0));
  assert.equal(empty[1].value, format.formatCurrency(0));
  assert.equal(empty[0].trendTone, "neutral");
  const metrics = buildDashboardMetrics([appointment("2026-10-22", "pending", 100)], "2026-10-22");
  assert.equal(metrics[1].trendValue, 100);
  assert.equal(metrics[1].trendTone, "danger");
});
