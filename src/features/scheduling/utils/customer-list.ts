import type { Customer } from "../types";

export type CustomerTag = "active" | "atRisk" | "frequent" | "new" | "vip";
export type CustomerTagFilter = CustomerTag | "all";
export type CustomerSort = "default" | "lastBookingDesc" | "lastBookingAsc" | "mostSpent" | "mostBookings";
export type CustomerSortOption = Exclude<CustomerSort, "default">;

export type CustomerListFilters = {
  dateFrom: string;
  dateTo: string;
  sort: CustomerSort;
  tag: CustomerTagFilter;
  timeZone: string;
};

export function getCustomerTag(customer: Customer, now = new Date()): CustomerTag {
  const lastBookingDate = new Date(customer.lastBookedAt);
  const riskThreshold = now.getTime() - (45 * 86400000);

  if (customer.lastBookedAt && !Number.isNaN(lastBookingDate.getTime()) && lastBookingDate.getTime() < riskThreshold) {
    return "atRisk";
  }

  if (customer.bookingCount > 20) return "vip";
  if (customer.bookingCount > 10) return "frequent";
  if (customer.bookingCount <= 2) return "new";
  return "active";
}

export function filterAndSortCustomers(customers: Customer[], filters: CustomerListFilters, now = new Date()) {
  const filtered = customers.filter((customer) => {
    if (filters.tag !== "all" && getCustomerTag(customer, now) !== filters.tag) return false;
    if (!filters.dateFrom && !filters.dateTo) return true;
    if (!customer.lastBookedAt || Number.isNaN(Date.parse(customer.lastBookedAt))) return false;

    const bookingDate = formatDateInTimeZone(customer.lastBookedAt, filters.timeZone);
    return (!filters.dateFrom || bookingDate >= filters.dateFrom) && (!filters.dateTo || bookingDate <= filters.dateTo);
  });

  if (filters.sort === "default") return filtered;

  return filtered.sort((left, right) => {
    let difference = 0;

    if (filters.sort === "mostSpent") difference = right.totalRevenue - left.totalRevenue;
    if (filters.sort === "mostBookings") difference = right.bookingCount - left.bookingCount;
    if (filters.sort === "lastBookingDesc" || filters.sort === "lastBookingAsc") {
      const leftDate = Date.parse(left.lastBookedAt);
      const rightDate = Date.parse(right.lastBookedAt);
      const leftMissing = Number.isNaN(leftDate);
      const rightMissing = Number.isNaN(rightDate);

      if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
      difference = filters.sort === "lastBookingDesc" ? rightDate - leftDate : leftDate - rightDate;
    }

    return difference || left.fullName.localeCompare(right.fullName) || left.id.localeCompare(right.id);
  });
}

export function getCustomerTotals(customers: Customer[]) {
  return customers.reduce((totals, customer) => ({
    recurringCustomers: totals.recurringCustomers + Number(customer.bookingCount > 1),
    totalBookings: totals.totalBookings + customer.bookingCount,
    totalRevenue: totals.totalRevenue + customer.totalRevenue
  }), { recurringCustomers: 0, totalBookings: 0, totalRevenue: 0 });
}

export function paginateCustomers(customers: Customer[], requestedPage: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(customers.length / perPage));
  const currentPage = Math.min(requestedPage, totalPages);

  return {
    currentPage,
    data: customers.slice((currentPage - 1) * perPage, currentPage * perPage),
    totalPages
  };
}

function formatDateInTimeZone(dateTime: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(dateTime));

  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}
