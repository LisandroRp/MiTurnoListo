import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateSubscriptionPaymentsByBusinessId,
  aggregateSubscriptionRevenueByBusinessId
} from "./subscription-revenue.ts";

const august2026 = {
  start: "2026-08-01T00:00:00.000Z",
  end: "2026-09-01T00:00:00.000Z"
};

test("estimates monthly and total revenue for active subscriptions", () => {
  const summaries = aggregateSubscriptionRevenueByBusinessId({
    monthRange: august2026,
    now: new Date("2026-08-25T00:00:00.000Z"),
    proPrice: 25000,
    rows: [
      {
        business_id: "business-1",
        cancelled_at: null,
        provider_status: "authorized",
        provider_subscription_id: "sub-1",
        started_at: "2026-06-10T00:00:00.000Z",
        subscription_tier: "pro"
      }
    ]
  });

  assert.deepEqual(summaries.get("business-1"), {
    monthlyPaidCount: 1,
    monthlyRevenue: 25000,
    totalPaidCount: 3,
    totalRevenue: 75000
  });
});

test("keeps cancelled subscriptions in historical revenue until cancellation", () => {
  const summaries = aggregateSubscriptionRevenueByBusinessId({
    monthRange: august2026,
    now: new Date("2026-08-25T00:00:00.000Z"),
    proPrice: 25000,
    rows: [
      {
        business_id: "business-1",
        cancelled_at: "2026-08-15T00:00:00.000Z",
        provider_status: "cancelled",
        provider_subscription_id: "sub-1",
        started_at: "2026-06-10T00:00:00.000Z",
        subscription_tier: "free"
      }
    ]
  });

  assert.deepEqual(summaries.get("business-1"), {
    monthlyPaidCount: 1,
    monthlyRevenue: 25000,
    totalPaidCount: 3,
    totalRevenue: 75000
  });
});

test("does not count pending attempts or rows without a provider subscription", () => {
  const summaries = aggregateSubscriptionRevenueByBusinessId({
    monthRange: august2026,
    now: new Date("2026-08-25T00:00:00.000Z"),
    proPrice: 25000,
    rows: [
      {
        business_id: "business-1",
        cancelled_at: null,
        provider_status: "pending",
        provider_subscription_id: "sub-1",
        started_at: "2026-08-10T00:00:00.000Z",
        subscription_tier: "free"
      },
      {
        business_id: "business-2",
        cancelled_at: null,
        provider_status: "manual",
        provider_subscription_id: null,
        started_at: "2026-08-10T00:00:00.000Z",
        subscription_tier: "pro"
      }
    ]
  });

  assert.equal(summaries.size, 0);
});

test("aggregates real approved subscription payments", () => {
  const summaries = aggregateSubscriptionPaymentsByBusinessId({
    monthRange: august2026,
    rows: [
      {
        amount: 25000,
        business_id: "business-1",
        paid_at: "2026-08-10T00:00:00.000Z",
        provider_status: "approved"
      },
      {
        amount: 25000,
        business_id: "business-1",
        paid_at: "2026-07-10T00:00:00.000Z",
        provider_status: "approved"
      },
      {
        amount: 25000,
        business_id: "business-1",
        paid_at: "2026-08-12T00:00:00.000Z",
        provider_status: "rejected"
      }
    ]
  });

  assert.deepEqual(summaries.get("business-1"), {
    monthlyPaidCount: 1,
    monthlyRevenue: 25000,
    totalPaidCount: 2,
    totalRevenue: 50000
  });
});
