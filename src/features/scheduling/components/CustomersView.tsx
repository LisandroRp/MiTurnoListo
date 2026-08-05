"use client";

import { ReactNode, useEffect, useState } from "react";
import { FiSearch } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";
import { getPayloadErrorMessage } from "@/lib/networking/response-errors";
import { getCustomers } from "@/lib/networking/endpoints/customers";
import { LoadingDotsText } from "@/features/scheduling/components/LoadingDotsText";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Customer } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";

const tableHeaderClassName = "px-4 py-3 text-xs font-bold uppercase tracking-[0.04em] text-muted";

type CustomersViewProps = {
  businessId: string | null;
  messages: Messages;
};

export function CustomersView({ businessId, messages }: CustomersViewProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(businessId));
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!businessId) {
      return;
    }

    let isActive = true;

    void getCustomers(businessId)
      .then((nextCustomers) => {
        if (isActive) {
          setCustomers(nextCustomers);
          setErrorMessage("");
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(getPayloadErrorMessage(error, messages.customers.loadError));
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [businessId, messages.customers.loadError]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleCustomers = customers.filter((customer) => {
    if (!normalizedQuery) {
      return true;
    }

    return [
      customer.fullName,
      customer.email,
      customer.phone
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  });
  const recurringCustomers = customers.filter((customer) => customer.bookingCount > 1);
  const totalBookings = customers.reduce((total, customer) => total + customer.bookingCount, 0);
  const estimatedRevenue = customers.reduce((total, customer) => total + customer.totalRevenue, 0);

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow={messages.customers.eyebrow}
        title={messages.customers.title}
        description={messages.customers.description}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CustomerMetricCard label={messages.customers.totalCustomers} value={String(customers.length)} isLoading={isLoading} />
        <CustomerMetricCard label={messages.customers.recurringCustomers} value={String(recurringCustomers.length)} isLoading={isLoading} />
        <CustomerMetricCard label={messages.customers.totalBookings} value={String(totalBookings)} isLoading={isLoading} />
        <CustomerMetricCard label={messages.customers.estimatedRevenue} value={formatCurrency(estimatedRevenue)} isLoading={isLoading} />
      </div>

      <label className="relative block max-w-xl">
        <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <span className="sr-only">{messages.actions.search}</span>
        <input
          type="search"
          value={searchQuery}
          placeholder={messages.customers.searchPlaceholder}
          className="h-11 w-full rounded-xl border border-subtle bg-input px-4 pl-10 text-sm text-primary shadow-sm outline-none transition placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-focus"
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </label>

      <section className="overflow-hidden rounded-3xl border border-subtle bg-surface shadow-sm">
        {isLoading ? (
          <CustomersState title={<LoadingDotsText text={messages.customers.loading} />} />
        ) : errorMessage ? (
          <CustomersState title={messages.customers.loadError} description={errorMessage} />
        ) : customers.length === 0 ? (
          <CustomersState title={messages.customers.emptyTitle} description={messages.customers.emptyDescription} />
        ) : visibleCustomers.length === 0 ? (
          <CustomersState title={messages.customers.noResults} />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead className="bg-shell">
                  <tr>
                    <th className={tableHeaderClassName}>{messages.customers.name}</th>
                    <th className={tableHeaderClassName}>{messages.customers.email}</th>
                    <th className={tableHeaderClassName}>{messages.customers.bookings}</th>
                    <th className={tableHeaderClassName}>{messages.customers.totalSpent}</th>
                    <th className={tableHeaderClassName}>{messages.customers.lastService}</th>
                    <th className={tableHeaderClassName}>{messages.customers.lastBooking}</th>
                    <th className={cx(tableHeaderClassName, "min-w-28")}>{messages.customers.tag}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {visibleCustomers.map((customer) => {
                    const customerTag = getCustomerTag(customer, messages);

                    return (
                    <tr key={customer.id} className="transition-colors hover:bg-brand-soft/45">
                      <td className="px-4 py-4">
                        <CustomerIdentity customer={customer} />
                      </td>
                      <td className="px-4 py-4 text-muted">{customer.email || "-"}</td>
                      <td className="px-4 py-4 font-semibold text-primary">{customer.bookingCount}</td>
                      <td className="px-4 py-4 font-semibold text-primary">{formatCurrency(customer.totalRevenue)}</td>
                      <td className="px-4 py-4 text-muted">{customer.lastServiceName || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-muted">{formatLastBookingLabel(customer.lastBookedAt, messages)}</td>
                      <td className="min-w-28 px-4 py-4">
                        <Badge tone={customerTag.tone} className={cx("whitespace-nowrap", customerTag.className)}>{customerTag.label}</Badge>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-4 lg:hidden">
              {visibleCustomers.map((customer) => (
                <CustomerMobileCard key={customer.id} customer={customer} messages={messages} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function CustomerMetricCard({ isLoading, label, value }: { isLoading: boolean; label: string; value: string }) {
  return (
    <Card className="grid gap-2">
      <span className="text-sm font-semibold text-muted">{label}</span>
      {isLoading ? (
        <span className="h-9 w-28 animate-pulse rounded-lg bg-surface-strong" aria-label={label} />
      ) : (
        <strong className="text-3xl font-black text-primary">{value}</strong>
      )}
    </Card>
  );
}

function CustomerMobileCard({ customer, messages }: { customer: Customer; messages: Messages }) {
  const customerTag = getCustomerTag(customer, messages);

  return (
    <div className="rounded-xl border border-subtle bg-input p-4">
      <div className="flex items-start justify-between gap-3">
        <CustomerIdentity customer={customer} />
        <Badge tone={customerTag.tone} className={customerTag.className}>{customerTag.label}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted">
        <CustomerDetail label={messages.customers.email} value={customer.email || "-"} />
        <CustomerDetail label={messages.customers.phone} value={formatPhoneForDisplay(customer.phone)} />
        <CustomerDetail label={messages.customers.bookings} value={String(customer.bookingCount)} />
        <CustomerDetail label={messages.customers.totalSpent} value={formatCurrency(customer.totalRevenue)} />
        <CustomerDetail label={messages.customers.lastService} value={customer.lastServiceName || "-"} />
        <CustomerDetail label={messages.customers.lastBooking} value={formatLastBookingLabel(customer.lastBookedAt, messages)} />
      </div>
    </div>
  );
}

function CustomerIdentity({ customer }: { customer: Customer }) {
  const initials = getCustomerInitials(customer.fullName || customer.email);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="min-w-0">
        <p className="truncate font-bold text-primary">{customer.fullName || "-"}</p>
        <p className="mt-1 truncate text-xs leading-5 text-muted">{formatPhoneForDisplay(customer.phone)}</p>
      </div>
    </div>
  );
}

function CustomerDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <strong className="text-right text-primary">{value}</strong>
    </div>
  );
}

function CustomersState({ title, description }: { title: ReactNode; description?: string }) {
  return (
    <div className="grid min-h-56 place-items-center p-6 text-center">
      <div>
        <h2 className="text-lg font-bold text-primary">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-muted">{description}</p> : null}
      </div>
    </div>
  );
}

function formatCustomerDate(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatLastBookingLabel(value: string, messages: Messages) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const visitStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.max(0, Math.floor((todayStart.getTime() - visitStart.getTime()) / 86400000));

  if (diffDays === 0) {
    return messages.customers.lastVisitRelative.today;
  }

  if (diffDays <= 6) {
    return messages.customers.lastVisitRelative.daysAgo.replace("{count}", String(diffDays));
  }

  if (diffDays <= 27) {
    const weeks = Math.max(1, Math.round(diffDays / 7));

    return messages.customers.lastVisitRelative.weeksAgo.replace("{count}", String(weeks));
  }

  if (diffDays <= 37) {
    return messages.customers.lastVisitRelative.oneMonthAgo;
  }

  return formatCustomerDate(value);
}

function formatPhoneForDisplay(value: string) {
  const compactValue = value.replace(/\s+/g, "");

  return compactValue || "-";
}

function getCustomerInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CL";
}

function getCustomerTag(customer: Customer, messages: Messages) {
  if (isCustomerAtRisk(customer.lastBookedAt)) {
    return { label: messages.customers.tags.atRisk, tone: "danger" as const };
  }

  if (customer.bookingCount > 20) {
    return { label: messages.customers.tags.vip, tone: "warning" as const, className: "bg-warning-soft text-warning" };
  }

  if (customer.bookingCount > 10) {
    return { label: messages.customers.tags.frequent, tone: "brand" as const };
  }

  if (customer.bookingCount <= 2) {
    return { label: messages.customers.tags.new, tone: "neutral" as const, className: "bg-shell !text-black" };
  }

  return { label: messages.customers.tags.active, tone: "success" as const };
}

function isCustomerAtRisk(lastBookedAt: string) {
  if (!lastBookedAt) {
    return false;
  }

  const lastBookingDate = new Date(lastBookedAt);

  if (Number.isNaN(lastBookingDate.getTime())) {
    return false;
  }

  const riskThreshold = new Date();
  riskThreshold.setDate(riskThreshold.getDate() - 45);

  return lastBookingDate < riskThreshold;
}
