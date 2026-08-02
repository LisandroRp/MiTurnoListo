"use client";

import { ReactNode, useEffect, useState } from "react";
import { FiSearch } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { Card } from "@/components/ui/Card";
import { getPayloadErrorMessage } from "@/lib/networking/response-errors";
import { getCustomers } from "@/lib/networking/endpoints/customers";
import { LoadingDotsText } from "@/features/scheduling/components/LoadingDotsText";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Customer } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";

const tableHeaderClassName = "relative px-5 py-3 text-center font-semibold after:absolute after:right-0 after:top-2 after:bottom-2 after:w-px after:bg-subtle last:after:hidden";

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

      <Card className="grid gap-4 overflow-hidden p-0">
        <div className="border-b border-subtle bg-sidebar p-4 sm:p-5">
          <label className="grid gap-2 text-sm font-semibold text-primary">
            {messages.actions.search}
            <span className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                placeholder={messages.customers.searchPlaceholder}
                className="h-11 w-full rounded-lg border border-subtle bg-input px-3 pl-9 text-sm text-primary outline-none transition-colors placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-focus"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </span>
          </label>
        </div>

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
                <thead className="bg-surface-strong text-muted">
                  <tr>
                    <th className={tableHeaderClassName}>{messages.customers.name}</th>
                    <th className={tableHeaderClassName}>{messages.customers.email}</th>
                    <th className={tableHeaderClassName}>{messages.customers.phone}</th>
                    <th className={tableHeaderClassName}>{messages.customers.bookings}</th>
                    <th className={tableHeaderClassName}>{messages.customers.totalSpent}</th>
                    <th className={tableHeaderClassName}>{messages.customers.lastService}</th>
                    <th className={tableHeaderClassName}>{messages.customers.lastBooking}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {visibleCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-primary">{customer.fullName || "-"}</span>
                          {customer.bookingCount > 1 ? <Badge tone="brand">{messages.customers.recurrent}</Badge> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted">{customer.email || "-"}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-muted">{formatPhoneForDisplay(customer.phone)}</td>
                      <td className="px-5 py-4 font-semibold text-primary">{customer.bookingCount}</td>
                      <td className="px-5 py-4 font-semibold text-primary">{formatCurrency(customer.totalRevenue)}</td>
                      <td className="px-5 py-4 text-muted">{customer.lastServiceName || "-"}</td>
                      <td className="px-5 py-4 text-muted">{formatCustomerDate(customer.lastBookedAt)}</td>
                    </tr>
                  ))}
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
      </Card>
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
  return (
    <div className="rounded-xl border border-subtle bg-input p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-primary">{customer.fullName || "-"}</p>
          <p className="mt-1 text-sm text-muted">{customer.email || "-"}</p>
        </div>
        {customer.bookingCount > 1 ? <Badge tone="brand">{messages.customers.recurrent}</Badge> : null}
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted">
        <CustomerDetail label={messages.customers.phone} value={formatPhoneForDisplay(customer.phone)} />
        <CustomerDetail label={messages.customers.bookings} value={String(customer.bookingCount)} />
        <CustomerDetail label={messages.customers.totalSpent} value={formatCurrency(customer.totalRevenue)} />
        <CustomerDetail label={messages.customers.lastService} value={customer.lastServiceName || "-"} />
        <CustomerDetail label={messages.customers.lastBooking} value={formatCustomerDate(customer.lastBookedAt)} />
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
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatPhoneForDisplay(value: string) {
  const compactValue = value.replace(/\s+/g, "");

  return compactValue || "-";
}
