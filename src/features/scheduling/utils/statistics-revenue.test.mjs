import assert from "node:assert/strict";
import test from "node:test";
import { buildStatisticsPaymentBreakdown, buildStatisticsRevenue, filterStatisticsRevenue } from "./statistics-revenue.ts";

const rows = [
  { id: "paid", appointmentStatus: "scheduled", paymentStatus: "paid", revenue: 200 },
  { id: "pending", appointmentStatus: "scheduled", paymentStatus: "pending", revenue: 300 },
  { id: "completed", appointmentStatus: "completed", paymentStatus: "pending", revenue: 100 },
  { id: "cancelled", appointmentStatus: "cancelled", paymentStatus: "pending", revenue: 5000 },
  { id: "rescheduled", appointmentStatus: "rescheduled", paymentStatus: "pending", revenue: 9000 },
  { id: "refunded", appointmentStatus: "completed", paymentStatus: "refunded", revenue: 700 }
];

test("estimated revenue equals paid plus pending using the same eligible bookings", () => {
  const summary = buildStatisticsRevenue(rows);
  assert.equal(summary.estimatedRevenue, 600);
  assert.equal(summary.capturedRevenue, 200);
  assert.equal(summary.pendingRevenue, 400);
  assert.equal(summary.estimatedRevenue, summary.capturedRevenue + summary.pendingRevenue);
  assert.equal(summary.averageTicket, 200);
  assert.deepEqual(summary.pending.map((row) => row.id), ["pending", "completed"]);
  assert.ok(summary.pendingRevenue <= summary.estimatedRevenue);
});

test("paid bookings that were cancelled or rescheduled do not inflate captured revenue", () => {
  const excluded = ["cancelled", "rescheduled"].map((appointmentStatus) => ({ appointmentStatus, paymentStatus: "paid", revenue: 1000 }));
  assert.equal(buildStatisticsRevenue(excluded).capturedRevenue, 0);
});

test("each revenue detail filter returns exactly the bookings that contribute to its metric", () => {
  for (const [filter, amount] of [["estimated", 600], ["paid", 200], ["pending", 400]]) {
    const filtered = filterStatisticsRevenue(rows, filter);
    assert.equal(filtered.reduce((sum, row) => sum + row.revenue, 0), amount);
  }
  assert.equal(filterStatisticsRevenue(rows, "all").length, rows.length);
  assert.equal(buildStatisticsRevenue([]).averageTicket, 0);
  assert.equal(buildStatisticsRevenue([]).estimatedRevenue, 0);
});

test("payment categories are exclusive, exclude rescheduled bookings and align with revenue counts", () => {
  const appointments = [
    ...rows,
    { appointmentStatus: "cancelled", paymentStatus: "paid", revenue: 100 },
    { appointmentStatus: "cancelled", paymentStatus: "refunded", revenue: 100 },
    { appointmentStatus: "rescheduled", paymentStatus: "paid", revenue: 100 }
  ];
  const breakdown = buildStatisticsPaymentBreakdown(appointments);
  assert.deepEqual(breakdown.counts, { paid: 1, pending: 2, cancelled: 2, refunded: 2 });
  assert.equal(breakdown.total, 7);
  const revenue = buildStatisticsRevenue(appointments);
  assert.equal(breakdown.counts.paid, revenue.paid.length);
  assert.equal(breakdown.counts.pending, revenue.pending.length);
  assert.equal(buildStatisticsPaymentBreakdown([]).total, 0);
});
