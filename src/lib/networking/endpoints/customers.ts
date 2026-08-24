"use client";

import { Customer } from "@/features/scheduling/types";
import { getAccessToken } from "@/lib/networking/endpoints/auth";
import { getResponseErrorMessage } from "@/lib/networking/response-errors";

export type CustomersPaginationMeta = {
  currentPage: number;
  perPage: number;
  recurringCustomers: number;
  totalBookings: number;
  totalCustomers: number;
  totalPages: number;
  totalRevenue: number;
};

export type CustomersResponse = {
  data: Customer[];
  meta: CustomersPaginationMeta;
};

type GetCustomersOptions = {
  page: number;
  perPage: number;
  search?: string;
};

export async function getCustomers(businessId: string, options: GetCustomersOptions): Promise<CustomersResponse> {
  const accessToken = await getAccessToken();
  const searchParams = new URLSearchParams({
    businessId,
    page: String(options.page),
    perPage: String(options.perPage)
  });

  if (options.search?.trim()) {
    searchParams.set("search", options.search.trim());
  }

  const response = await fetch(`/api/customers?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, "Unable to load customers."));
  }

  const payload = await response.json() as {
    data?: Customer[];
    meta?: Partial<CustomersPaginationMeta>;
  };

  return {
    data: payload.data ?? [],
    meta: {
      currentPage: payload.meta?.currentPage ?? options.page,
      perPage: payload.meta?.perPage ?? options.perPage,
      recurringCustomers: payload.meta?.recurringCustomers ?? 0,
      totalBookings: payload.meta?.totalBookings ?? 0,
      totalCustomers: payload.meta?.totalCustomers ?? 0,
      totalPages: payload.meta?.totalPages ?? 1,
      totalRevenue: payload.meta?.totalRevenue ?? 0
    }
  };
}
