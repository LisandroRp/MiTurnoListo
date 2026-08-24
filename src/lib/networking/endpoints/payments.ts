"use client";

import { PaymentRecord } from "@/features/scheduling/types";
import { getAccessToken } from "@/lib/networking/endpoints/auth";
import { getResponseErrorMessage } from "@/lib/networking/response-errors";

export type PaymentsPaginationMeta = {
  currentPage: number;
  perPage: number;
  totalAmount: number;
  totalItems: number;
  totalPages: number;
};

export type PaymentsResponse = {
  data: PaymentRecord[];
  meta: PaymentsPaginationMeta;
};

type GetPaymentsOptions = {
  method: string;
  page: number;
  perPage: number;
  status: string;
};

export async function getPayments(businessId: string, options: GetPaymentsOptions): Promise<PaymentsResponse> {
  const accessToken = await getAccessToken();
  const searchParams = new URLSearchParams({
    businessId,
    method: options.method,
    page: String(options.page),
    perPage: String(options.perPage),
    status: options.status
  });
  const response = await fetch(`/api/payments?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await getResponseErrorMessage(response, "Unable to load payments."));
  }

  const payload = await response.json() as {
    data?: PaymentRecord[];
    meta?: Partial<PaymentsPaginationMeta>;
  };

  return {
    data: payload.data ?? [],
    meta: {
      currentPage: payload.meta?.currentPage ?? options.page,
      perPage: payload.meta?.perPage ?? options.perPage,
      totalAmount: payload.meta?.totalAmount ?? 0,
      totalItems: payload.meta?.totalItems ?? 0,
      totalPages: payload.meta?.totalPages ?? 1
    }
  };
}
