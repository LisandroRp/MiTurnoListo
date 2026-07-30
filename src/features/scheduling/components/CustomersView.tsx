"use client";

import { useEffect, useState } from "react";

import { SectionHeader } from "@/components/composed/SectionHeader";
import { Card } from "@/components/ui/Card";
import { getPayloadErrorMessage } from "@/lib/networking/response-errors";
import { getCustomers } from "@/lib/networking/endpoints/customers";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Customer } from "@/features/scheduling/types";

type CustomersViewProps = {
  businessId: string | null;
  messages: Messages;
};

export function CustomersView({ businessId, messages }: CustomersViewProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
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

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow={messages.customers.eyebrow}
        title={messages.customers.title}
        description={messages.customers.description}
      />

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <CustomersState title={messages.customers.loading} />
        ) : errorMessage ? (
          <CustomersState title={messages.customers.loadError} description={errorMessage} />
        ) : customers.length === 0 ? (
          <CustomersState title={messages.customers.emptyTitle} description={messages.customers.emptyDescription} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-surface-strong text-left text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">{messages.customers.name}</th>
                  <th className="px-5 py-3 font-semibold">{messages.customers.email}</th>
                  <th className="px-5 py-3 font-semibold">{messages.customers.phone}</th>
                  <th className="px-5 py-3 font-semibold">{messages.customers.lastBooking}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td className="px-5 py-4 font-semibold text-primary">{customer.fullName || "-"}</td>
                    <td className="px-5 py-4 text-muted">{customer.email || "-"}</td>
                    <td className="px-5 py-4 text-muted">{customer.phone || "-"}</td>
                    <td className="px-5 py-4 text-muted">{formatCustomerDate(customer.lastBookedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function CustomersState({ title, description }: { title: string; description?: string }) {
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
