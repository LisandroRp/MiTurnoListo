import assert from "node:assert/strict";
import test from "node:test";
import { sortAppointments } from "./appointment-order.ts";

const rows = [
  { id: "a", customerName: "Álvaro", date: "2026-05-08", startTime: "10:00", createdAt: "2026-05-01T12:00:00Z", paymentStatus: "pending" },
  { id: "b", customerName: "Zoe", date: "2026-05-09", startTime: "10:00", createdAt: "2026-05-03T12:00:00Z", paymentStatus: "pending" }
];
const ids = (rows) => rows.map((row) => row.id);
test("activity orders by creation until payment confirmation moves an appointment to the top", () => {
  assert.deepEqual(ids(sortAppointments(rows, "activity")), ["b", "a"]);
  const paid = [{ ...rows[0], paymentStatus: "paid", paymentConfirmedAt: "2026-05-05T12:00:00Z" }, rows[1]];
  assert.deepEqual(ids(sortAppointments(paid, "activity")), ["a", "b"]);
  assert.deepEqual(ids(rows), ["a", "b"]);
  assert.deepEqual(ids(sortAppointments([{ ...rows[0], paymentConfirmedAt: "invalid" }, rows[1]], "activity")), ["b", "a"]);
});
test("name and appointment-date orders remain available with deterministic ties", () => {
  assert.deepEqual(ids(sortAppointments(rows, "nameAsc")), ["a", "b"]);
  assert.deepEqual(ids(sortAppointments(rows, "nameDesc")), ["b", "a"]);
  assert.deepEqual(ids(sortAppointments(rows, "newest")), ["b", "a"]);
  assert.deepEqual(ids(sortAppointments(rows, "oldest")), ["a", "b"]);
  const legacy = rows.map(({ createdAt, ...row }) => row);
  assert.deepEqual(ids(sortAppointments(legacy, "activity")), ["b", "a"]);
});
