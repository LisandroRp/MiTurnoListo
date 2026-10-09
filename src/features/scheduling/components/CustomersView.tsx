"use client";

import { ReactNode, useEffect, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiSearch } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { cx } from "@/components/ui/utils";
import { getPayloadErrorMessage } from "@/lib/networking/response-errors";
import { CustomersPaginationMeta, getCustomers } from "@/lib/networking/endpoints/customers";
import { LoadingDotsText } from "@/features/scheduling/components/LoadingDotsText";
import { CustomerFilters } from "@/features/scheduling/components/CustomerFilters";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Customer } from "@/features/scheduling/types";
import { CustomerSortOption, CustomerTagFilter, getCustomerTag as getCustomerTagKey } from "@/features/scheduling/utils/customer-list";
import { formatCurrency } from "@/features/scheduling/utils/format";

const tableHeaderClassName = "px-4 py-3 text-xs font-bold uppercase tracking-[0.04em] text-muted";
const perPageOptions = [10, 20, 50, 100];

const defaultPaginationMeta: CustomersPaginationMeta = {
  currentPage: 1,
  perPage: 10,
  recurringCustomers: 0,
  totalBookings: 0,
  totalCustomers: 0,
  totalPages: 1,
  totalRevenue: 0
};

type CustomersViewProps = {
  businessId: string | null;
  messages: Messages;
};

export function CustomersView({ businessId, messages }: CustomersViewProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sort, setSort] = useState<CustomerSortOption>("lastBookingDesc");
  const [tag, setTag] = useState<CustomerTagFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paginationMeta, setPaginationMeta] = useState<CustomersPaginationMeta>(defaultPaginationMeta);
  const [isLoading, setIsLoading] = useState(Boolean(businessId));
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const debounceTimer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
      setCurrentPage(1);
    }, 180);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!businessId) {
      return;
    }

    let isActive = true;

    void getCustomers(businessId, {
      dateFrom,
      dateTo,
      page: currentPage,
      perPage,
      search: debouncedSearchQuery,
      sort,
      tag
    })
      .then((response) => {
        if (isActive) {
          setCustomers(response.data);
          setPaginationMeta(response.meta);
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
  }, [businessId, currentPage, dateFrom, dateTo, debouncedSearchQuery, messages.customers.loadError, perPage, sort, tag]);

  function resetFilters() {
    if (!searchQuery && sort === "lastBookingDesc" && tag === "all" && !dateFrom && !dateTo) return;
    setIsLoading(true);
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setSort("lastBookingDesc");
    setTag("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow={messages.customers.eyebrow}
        title={messages.customers.title}
        description={messages.customers.description}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CustomerMetricCard label={messages.customers.totalCustomers} value={String(paginationMeta.totalCustomers)} isLoading={isLoading} />
        <CustomerMetricCard label={messages.customers.recurringCustomers} value={String(paginationMeta.recurringCustomers)} isLoading={isLoading} />
        <CustomerMetricCard label={messages.customers.totalBookings} value={String(paginationMeta.totalBookings)} isLoading={isLoading} />
        <CustomerMetricCard label={messages.customers.estimatedRevenue} value={formatCurrency(paginationMeta.totalRevenue)} isLoading={isLoading} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem] lg:items-end">
        <label className="relative block w-full">
          <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <span className="sr-only">{messages.actions.search}</span>
          <input
            type="search"
            value={searchQuery}
            placeholder={messages.customers.searchPlaceholder}
            className="h-11 w-full rounded-xl border border-subtle bg-input px-4 pl-10 text-sm text-primary shadow-sm outline-none transition placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-focus"
            onChange={(event) => {
              setIsLoading(true);
              setSearchQuery(event.target.value);
            }}
          />
        </label>
        <SelectField
          label={messages.customers.perPage}
          name="customers-per-page"
          value={String(perPage)}
          className="w-full"
          options={perPageOptions.map((option) => ({ value: String(option), label: String(option) }))}
          onChange={(event) => {
            setIsLoading(true);
            setPerPage(Number(event.target.value));
            setCurrentPage(1);
          }}
        />
      </div>

      <CustomerFilters
        canClear={Boolean(searchQuery || sort !== "lastBookingDesc" || tag !== "all" || dateFrom || dateTo)}
        dateFrom={dateFrom}
        dateTo={dateTo}
        messages={messages}
        sort={sort}
        tag={tag}
        onClear={resetFilters}
        onDateFromChange={(value) => {
          setIsLoading(true);
          setDateFrom(value);
          if (dateTo && value > dateTo) setDateTo("");
          setCurrentPage(1);
        }}
        onDateToChange={(value) => {
          setIsLoading(true);
          setDateTo(value);
          if (dateFrom && value < dateFrom) setDateFrom("");
          setCurrentPage(1);
        }}
        onSortChange={(value) => {
          setIsLoading(true);
          setSort(value);
          setCurrentPage(1);
        }}
        onTagChange={(value) => {
          setIsLoading(true);
          setTag(value);
          setCurrentPage(1);
        }}
      />

      <section className="overflow-hidden rounded-3xl border border-subtle bg-surface shadow-sm">
        {isLoading ? (
          <CustomersState title={<LoadingDotsText text={messages.customers.loading} />} />
        ) : errorMessage ? (
          <CustomersState title={messages.customers.loadError} description={errorMessage} />
        ) : customers.length === 0 ? (
          debouncedSearchQuery || tag !== "all" || dateFrom || dateTo ? (
            <CustomersState title={messages.customers.noFilteredResults} />
          ) : (
            <CustomersState title={messages.customers.emptyTitle} description={messages.customers.emptyDescription} />
          )
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
                  {customers.map((customer) => {
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
              {customers.map((customer) => (
                <CustomerMobileCard key={customer.id} customer={customer} messages={messages} />
              ))}
            </div>

            <CustomersPagination
              messages={messages}
              meta={paginationMeta}
              onPageChange={(page) => {
                setIsLoading(true);
                setCurrentPage(page);
              }}
            />
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

function CustomersPagination({
  messages,
  meta,
  onPageChange
}: {
  messages: Messages;
  meta: CustomersPaginationMeta;
  onPageChange: (page: number) => void;
}) {
  const pages = getVisiblePages(meta.currentPage, meta.totalPages);
  const firstItem = meta.totalCustomers === 0 ? 0 : ((meta.currentPage - 1) * meta.perPage) + 1;
  const lastItem = Math.min(meta.currentPage * meta.perPage, meta.totalCustomers);

  return (
    <div className="flex flex-col gap-3 border-t border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-muted">
        {messages.customers.paginationSummary
          .replace("{from}", String(firstItem))
          .replace("{to}", String(lastItem))
          .replace("{total}", String(meta.totalCustomers))}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          aria-label={messages.customers.previousPage}
          disabled={meta.currentPage <= 1}
          onClick={() => onPageChange(meta.currentPage - 1)}
        >
          <FiChevronLeft />
        </Button>

        {pages.map((page) => (
          <Button
            key={page}
            size="sm"
            variant={page === meta.currentPage ? "primary" : "secondary"}
            onClick={() => onPageChange(page)}
          >
            {page}
          </Button>
        ))}

        <Button
          size="icon"
          variant="secondary"
          aria-label={messages.customers.nextPage}
          disabled={meta.currentPage >= meta.totalPages}
          onClick={() => onPageChange(meta.currentPage + 1)}
        >
          <FiChevronRight />
        </Button>
      </div>
    </div>
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

function getVisiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);

  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
}

function getCustomerTag(customer: Customer, messages: Messages) {
  const tag = getCustomerTagKey(customer);
  const tone: "danger" | "warning" | "brand" | "neutral" | "success" = tag === "atRisk" ? "danger" : tag === "vip" ? "warning" : tag === "frequent" ? "brand" : tag === "new" ? "neutral" : "success";
  const className = tag === "vip" ? "bg-warning-soft text-warning" : tag === "new" ? "bg-shell text-primary" : undefined;
  return { label: messages.customers.tags[tag], tone, className };
}
