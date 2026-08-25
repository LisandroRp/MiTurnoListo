export type SubscriptionRevenueRow = {
  business_id: string;
  cancelled_at: string | null;
  provider_status: string | null;
  provider_subscription_id: string | null;
  started_at: string | null;
  subscription_tier: string | null;
};

export type SubscriptionRevenueSummary = {
  monthlyPaidCount: number;
  monthlyRevenue: number;
  totalPaidCount: number;
  totalRevenue: number;
};

export type SubscriptionPaymentRevenueRow = {
  amount: number | string | null;
  business_id: string;
  paid_at: string | null;
  provider_status: string | null;
};

export function aggregateSubscriptionRevenueByBusinessId({
  monthRange,
  proPrice,
  rows,
  now = new Date()
}: {
  monthRange: { end: string; start: string };
  now?: Date;
  proPrice: number;
  rows: SubscriptionRevenueRow[];
}) {
  const monthStart = new Date(monthRange.start);
  const monthEnd = new Date(monthRange.end);

  return rows.reduce<Map<string, SubscriptionRevenueSummary>>((accumulator, row) => {
    if (!isPaidSubscription(row)) {
      return accumulator;
    }

    const startedAt = parseDate(row.started_at);

    if (!startedAt) {
      return accumulator;
    }

    const effectiveEnd = parseDate(row.cancelled_at) ?? now;
    const monthlyPaidCount = countBillingCyclesInRange(startedAt, effectiveEnd, monthStart, monthEnd);
    const totalPaidCount = countBillingCyclesBetween(startedAt, effectiveEnd);
    const current = accumulator.get(row.business_id) ?? {
      monthlyPaidCount: 0,
      monthlyRevenue: 0,
      totalPaidCount: 0,
      totalRevenue: 0
    };

    accumulator.set(row.business_id, {
      monthlyPaidCount: current.monthlyPaidCount + monthlyPaidCount,
      monthlyRevenue: current.monthlyRevenue + (monthlyPaidCount * proPrice),
      totalPaidCount: current.totalPaidCount + totalPaidCount,
      totalRevenue: current.totalRevenue + (totalPaidCount * proPrice)
    });

    return accumulator;
  }, new Map<string, SubscriptionRevenueSummary>());
}

export function aggregateSubscriptionPaymentsByBusinessId({
  monthRange,
  rows
}: {
  monthRange: { end: string; start: string };
  rows: SubscriptionPaymentRevenueRow[];
}) {
  const monthStart = new Date(monthRange.start);
  const monthEnd = new Date(monthRange.end);

  return rows.reduce<Map<string, SubscriptionRevenueSummary>>((accumulator, row) => {
    if (row.provider_status !== "approved") {
      return accumulator;
    }

    const paidAt = parseDate(row.paid_at);
    const amount = Number(row.amount ?? 0);
    const current = accumulator.get(row.business_id) ?? {
      monthlyPaidCount: 0,
      monthlyRevenue: 0,
      totalPaidCount: 0,
      totalRevenue: 0
    };
    const isCurrentMonth = Boolean(paidAt && paidAt >= monthStart && paidAt < monthEnd);

    accumulator.set(row.business_id, {
      monthlyPaidCount: current.monthlyPaidCount + (isCurrentMonth ? 1 : 0),
      monthlyRevenue: current.monthlyRevenue + (isCurrentMonth ? amount : 0),
      totalPaidCount: current.totalPaidCount + 1,
      totalRevenue: current.totalRevenue + amount
    });

    return accumulator;
  }, new Map<string, SubscriptionRevenueSummary>());
}

function isPaidSubscription(row: SubscriptionRevenueRow) {
  return Boolean(row.provider_subscription_id) &&
    (
      row.provider_status === "authorized" ||
      row.provider_status === "cancelled" ||
      row.provider_status === "canceled" ||
      row.subscription_tier === "pro"
    );
}

function countBillingCyclesBetween(startDate: Date, endDate: Date) {
  if (endDate < startDate) {
    return 0;
  }

  let cycles = 1;
  let nextBillingDate = addMonths(startDate, cycles);

  while (nextBillingDate <= endDate) {
    cycles += 1;
    nextBillingDate = addMonths(startDate, cycles);
  }

  return cycles;
}

function countBillingCyclesInRange(startDate: Date, endDate: Date, rangeStart: Date, rangeEnd: Date) {
  if (endDate < startDate || endDate < rangeStart || startDate >= rangeEnd) {
    return 0;
  }

  let cycles = 0;
  let cycleIndex = 0;
  let billingDate = addMonths(startDate, cycleIndex);

  while (billingDate <= endDate && billingDate < rangeEnd) {
    if (billingDate >= rangeStart) {
      cycles += 1;
    }

    cycleIndex += 1;
    billingDate = addMonths(startDate, cycleIndex);
  }

  return cycles;
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  const originalDay = nextDate.getUTCDate();
  nextDate.setUTCMonth(nextDate.getUTCMonth() + months, 1);
  const lastDayOfTargetMonth = new Date(Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)).getUTCDate();
  nextDate.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));

  return nextDate;
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}
