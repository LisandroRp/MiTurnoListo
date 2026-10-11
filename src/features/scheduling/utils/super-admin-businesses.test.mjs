import assert from "node:assert/strict";
import test from "node:test";

import { sortSuperAdminBusinesses } from "./super-admin-businesses.ts";

const businesses = [
  { businessId: "missing", businessName: "Zeta", ownerCreatedAt: "" },
  { businessId: "older", businessName: "Álamo", ownerCreatedAt: "2025-01-01T12:00:00Z" },
  { businessId: "newer", businessName: "Beta", ownerCreatedAt: "2026-09-01T12:00:00Z" },
  { businessId: "same-day", businessName: "Casa", ownerCreatedAt: "2026-09-01T12:00:00Z" },
  { businessId: "invalid", businessName: "Ypsilon", ownerCreatedAt: "invalid date" }
];

test("sorts businesses by signup date in both directions, keeping missing dates last", () => {
  assert.deepEqual(
    sortSuperAdminBusinesses(businesses, "newest").map((business) => business.businessId),
    ["newer", "same-day", "older", "invalid", "missing"]
  );
  assert.deepEqual(
    sortSuperAdminBusinesses(businesses, "oldest").map((business) => business.businessId),
    ["older", "newer", "same-day", "invalid", "missing"]
  );
});

test("sorts by business name without changing the source list", () => {
  const originalOrder = businesses.map((business) => business.businessId);

  assert.deepEqual(
    sortSuperAdminBusinesses(businesses, "name").map((business) => business.businessId),
    ["older", "newer", "same-day", "invalid", "missing"]
  );
  assert.deepEqual(businesses.map((business) => business.businessId), originalOrder);
});
