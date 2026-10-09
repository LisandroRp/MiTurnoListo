import assert from "node:assert/strict";
import test from "node:test";

import { filterAndSortCustomers, getCustomerTag, getCustomerTotals, paginateCustomers } from "./customer-list.ts";

function customer(id, overrides = {}) {
  return {
    id,
    bookingCount: 1,
    fullName: id,
    email: "",
    phone: "",
    lastBookedAt: "2026-10-09T01:00:00Z",
    lastServiceName: "",
    totalRevenue: 0,
    ...overrides
  };
}

const filters = {
  dateFrom: "",
  dateTo: "",
  sort: "default",
  tag: "all",
  timeZone: "America/Argentina/Buenos_Aires"
};

test("customer tags use the same priority as the visible badges", () => {
  const now = new Date("2026-10-09T12:00:00Z");

  assert.equal(getCustomerTag(customer("risk", { bookingCount: 21, lastBookedAt: "2026-01-01T12:00:00Z" }), now), "atRisk");
  assert.equal(getCustomerTag(customer("vip", { bookingCount: 21 }), now), "vip");
  assert.equal(getCustomerTag(customer("frequent", { bookingCount: 11 }), now), "frequent");
  assert.equal(getCustomerTag(customer("active", { bookingCount: 3 }), now), "active");
  assert.equal(getCustomerTag(customer("new"), now), "new");
});

test("date range uses the business date and combines with tags", () => {
  const customers = [
    customer("before", { lastBookedAt: "2026-10-09T01:00:00Z" }),
    customer("inside", { lastBookedAt: "2026-10-09T04:00:00Z" }),
    customer("frequent", { bookingCount: 12, lastBookedAt: "2026-10-09T04:00:00Z" })
  ];

  assert.deepEqual(filterAndSortCustomers(customers, {
    ...filters,
    dateFrom: "2026-10-09",
    dateTo: "2026-10-09",
    tag: "new"
  }).map((item) => item.id), ["inside"]);
});

test("sorting spans the complete customer set before pagination", () => {
  const customers = [
    customer("low", { bookingCount: 3, totalRevenue: 5, lastBookedAt: "2026-10-07T12:00:00Z" }),
    customer("high", { bookingCount: 10, totalRevenue: 100, lastBookedAt: "2026-10-08T12:00:00Z" }),
    customer("medium", { bookingCount: 5, totalRevenue: 50, lastBookedAt: "2026-10-09T12:00:00Z" })
  ];

  assert.deepEqual(filterAndSortCustomers(customers, { ...filters, sort: "mostSpent" }).map((item) => item.id), ["high", "medium", "low"]);
  assert.deepEqual(filterAndSortCustomers(customers, { ...filters, sort: "mostBookings" }).map((item) => item.id), ["high", "medium", "low"]);
  assert.deepEqual(filterAndSortCustomers(customers, { ...filters, sort: "lastBookingAsc" }).map((item) => item.id), ["low", "high", "medium"]);
  assert.deepEqual(filterAndSortCustomers(customers, { ...filters, sort: "lastBookingDesc" }).map((item) => item.id), ["medium", "high", "low"]);
  assert.deepEqual(getCustomerTotals(customers), { recurringCustomers: 3, totalBookings: 18, totalRevenue: 155 });
});

test("a top customer from a later source page appears on the first sorted page", () => {
  const customers = Array.from({ length: 12 }, (_, index) => customer(`customer-${index}`, { totalRevenue: index === 11 ? 1000 : index }));
  const sorted = filterAndSortCustomers(customers, { ...filters, sort: "mostSpent" });
  const firstPage = paginateCustomers(sorted, 1, 10);
  const secondPage = paginateCustomers(sorted, 2, 10);

  assert.equal(firstPage.data[0].id, "customer-11");
  assert.equal(firstPage.data.length, 10);
  assert.equal(firstPage.totalPages, 2);
  assert.equal(secondPage.data.length, 2);
});
