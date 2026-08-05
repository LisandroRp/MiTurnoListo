"use client";

import { ReactNode, useEffect, useState } from "react";

import { SectionHeader } from "@/components/composed/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { getPayloadErrorMessage } from "@/lib/networking/response-errors";
import { getPayments } from "@/lib/networking/endpoints/payments";
import { LoadingDotsText } from "@/features/scheduling/components/LoadingDotsText";
import { Messages } from "@/features/scheduling/i18n/messages";
import { PaymentMethod, PaymentRecord, PaymentStatus } from "@/features/scheduling/types";
import { formatCurrency } from "@/features/scheduling/utils/format";

type PaymentsViewProps = {
  businessId: string | null;
  messages: Messages;
  onMarkAppointmentPaid: (appointmentId: string) => Promise<boolean>;
};

type StatusFilter = PaymentStatus | "all";
type MethodFilter = PaymentMethod | "all";

const statusToneMap: Record<PaymentStatus, "success" | "warning" | "danger" | "neutral"> = {
  cancelled: "danger",
  paid: "success",
  pending: "warning",
  refunded: "neutral"
};
const tableHeaderClassName = "relative px-5 py-3 text-center font-semibold after:absolute after:right-0 after:top-2 after:bottom-2 after:w-px after:bg-subtle last:after:hidden";
const compactTableHeaderClassName = "relative w-fit whitespace-nowrap px-4 py-3 text-center font-semibold after:absolute after:right-0 after:top-2 after:bottom-2 after:w-px after:bg-subtle last:after:hidden";

export function PaymentsView({ businessId, messages, onMarkAppointmentPaid }: PaymentsViewProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [isLoading, setIsLoading] = useState(Boolean(businessId));
  const [loadingPaymentId, setLoadingPaymentId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!businessId) {
      return;
    }

    let isActive = true;

    void loadPaymentRecords(businessId, messages.payments.loadError).then((result) => {
      if (!isActive) {
        return;
      }

      setPayments(result.payments);
      setErrorMessage(result.errorMessage);
      setIsLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [businessId, messages.payments.loadError]);

  const filteredPayments = payments.filter((payment) => (
    (statusFilter === "all" || payment.status === statusFilter) &&
    (methodFilter === "all" || payment.method === methodFilter)
  ));
  const paidPayments = payments.filter((payment) => payment.status === "paid");
  const pendingPayments = payments.filter((payment) => payment.status === "pending");
  const cancelledPayments = payments.filter((payment) => payment.status === "cancelled");
  const refundedPayments = payments.filter((payment) => payment.status === "refunded");
  const collectedAmount = paidPayments.reduce((total, payment) => total + payment.amount, 0);
  const pendingAmount = pendingPayments.reduce((total, payment) => total + payment.amount, 0);

  async function handleMarkPaid(payment: PaymentRecord) {
    setLoadingPaymentId(payment.id);
    const didUpdate = await onMarkAppointmentPaid(payment.appointmentId);
    setLoadingPaymentId("");

    if (didUpdate && businessId) {
      const result = await loadPaymentRecords(businessId, messages.payments.loadError);
      setPayments(result.payments);
      setErrorMessage(result.errorMessage);
    }
  }

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow={messages.payments.eyebrow}
        title={messages.payments.title}
        description={messages.payments.description}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PaymentMetricCard label={messages.payments.collected} value={formatCurrency(collectedAmount)} helper={`${paidPayments.length} ${messages.payments.statuses.paid.toLowerCase()}`} tone="success" isLoading={isLoading} />
        <PaymentMetricCard label={messages.payments.pending} value={formatCurrency(pendingAmount)} helper={`${pendingPayments.length} ${messages.payments.statuses.pending.toLowerCase()}`} tone="warning" isLoading={isLoading} />
        <PaymentMetricCard label={messages.payments.cancelled} value={String(cancelledPayments.length)} helper={messages.payments.refunded + `: ${refundedPayments.length}`} tone="danger" isLoading={isLoading} />
        <PaymentMetricCard label={messages.payments.totalPayments} value={String(payments.length)} helper={messages.payments.manualValidationHint} tone="brand" isLoading={isLoading} />
      </div>

      <Card className="grid gap-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <p className="rounded-lg border border-warning bg-warning-soft p-3 text-sm leading-6 text-warning">
            {messages.payments.manualValidationHint}
          </p>
          <FilterSelect
            label={messages.payments.statusFilter}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            options={[
              { value: "all", label: messages.payments.allStatuses },
              { value: "pending", label: messages.payments.statuses.pending },
              { value: "paid", label: messages.payments.statuses.paid },
              { value: "cancelled", label: messages.payments.statuses.cancelled },
              { value: "refunded", label: messages.payments.statuses.refunded }
            ]}
          />
          <FilterSelect
            label={messages.payments.methodFilter}
            value={methodFilter}
            onChange={(value) => setMethodFilter(value as MethodFilter)}
            options={[
              { value: "all", label: messages.payments.allMethods },
              { value: "card", label: messages.paymentMethods.card },
              { value: "transfer", label: messages.paymentMethods.transfer },
              { value: "cash", label: messages.paymentMethods.cash },
              { value: "mixed", label: messages.paymentMethods.mixed }
            ]}
          />
        </div>

        {isLoading ? (
          <PaymentsState title={<LoadingDotsText text={messages.payments.loading} />} />
        ) : errorMessage ? (
          <PaymentsState title={messages.payments.loadError} description={errorMessage} />
        ) : payments.length === 0 ? (
          <PaymentsState title={messages.payments.emptyTitle} description={messages.payments.emptyDescription} />
        ) : filteredPayments.length === 0 ? (
          <PaymentsState title={messages.payments.noResults} />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1040px] border-collapse text-sm">
                <thead className="bg-surface-strong text-muted">
                  <tr>
                    <th className={tableHeaderClassName}>{messages.payments.customer}</th>
                    <th className={tableHeaderClassName}>{messages.payments.service}</th>
                    <th className={tableHeaderClassName}>{messages.payments.professional}</th>
                    <th className={compactTableHeaderClassName}>{messages.payments.date}</th>
                    <th className={tableHeaderClassName}>{messages.payments.method}</th>
                    <th className={tableHeaderClassName}>{messages.payments.status}</th>
                    <th className={tableHeaderClassName}>{messages.payments.amount}</th>
                    <th className={tableHeaderClassName}>{messages.payments.contact}</th>
                    <th className={compactTableHeaderClassName}>{messages.payments.action}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {filteredPayments.map((payment) => (
                    <PaymentTableRow
                      key={payment.id}
                      messages={messages}
                      payment={payment}
                      isLoading={loadingPaymentId === payment.id}
                      onMarkPaid={() => void handleMarkPaid(payment)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 lg:hidden">
              {filteredPayments.map((payment) => (
                <PaymentMobileCard
                  key={payment.id}
                  messages={messages}
                  payment={payment}
                  isLoading={loadingPaymentId === payment.id}
                  onMarkPaid={() => void handleMarkPaid(payment)}
                />
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

async function loadPaymentRecords(businessId: string, fallbackMessage: string) {
  try {
    return {
      errorMessage: "",
      payments: await getPayments(businessId)
    };
  } catch (error) {
    return {
      errorMessage: getPayloadErrorMessage(error, fallbackMessage),
      payments: []
    };
  }
}

function PaymentMetricCard({
  helper,
  isLoading,
  label,
  tone,
  value
}: {
  helper: string;
  isLoading: boolean;
  label: string;
  tone: "brand" | "danger" | "success" | "warning";
  value: string;
}) {
  const toneClassName = {
    brand: "bg-brand-soft text-brand-strong",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning"
  }[tone];

  return (
    <Card className="grid gap-3">
      <span className={`w-fit h-fit justify-center items-center text-center rounded-full px-3 py-3 text-xs font-bold uppercase tracking-[0.18em] ${toneClassName}`}>
        {label}
      </span>
      {isLoading ? (
        <>
          <span className="h-9 w-32 animate-pulse rounded-lg bg-surface-strong" aria-label={label} />
          <span className="h-5 w-40 animate-pulse rounded-md bg-surface-strong" />
        </>
      ) : (
        <>
          <strong className="text-3xl font-black text-primary">{value}</strong>
          <p className="text-sm leading-6 text-muted">{helper}</p>
        </>
      )}
    </Card>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  value: string;
}) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-52 font-semibold"
      options={options}
    />
  );
}

function PaymentTableRow({
  isLoading,
  messages,
  onMarkPaid,
  payment
}: {
  isLoading: boolean;
  messages: Messages;
  onMarkPaid: () => void;
  payment: PaymentRecord;
}) {
  return (
    <tr>
      <td className="px-5 py-4">
        <p className="font-semibold text-primary">{payment.customerName || "-"}</p>
        <p className="mt-1 text-xs text-muted">{payment.customerEmail || "-"}</p>
      </td>
      <td className="px-5 py-4 text-muted">{payment.serviceName || "-"}</td>
      <td className="px-5 py-4 text-muted">{payment.employeeName || "-"}</td>
      <td className="w-fit whitespace-nowrap px-4 py-4 text-muted">{formatPaymentDate(payment.date)} · {payment.startTime}</td>
      <td className="px-5 py-4 text-muted">{messages.paymentMethods[payment.method]}</td>
      <td className="px-5 py-4">
        <PaymentStatusBadge messages={messages} status={payment.status} />
      </td>
      <td className="px-5 py-4 font-semibold text-primary">{formatCurrency(payment.amount)}</td>
      <td className="whitespace-nowrap px-5 py-4 text-muted">{formatPhoneForDisplay(payment.customerPhone)}</td>
      <td className="w-fit whitespace-nowrap px-4 py-4 text-right">
        <PaymentAction messages={messages} payment={payment} isLoading={isLoading} onMarkPaid={onMarkPaid} />
      </td>
    </tr>
  );
}

function PaymentMobileCard({
  isLoading,
  messages,
  onMarkPaid,
  payment
}: {
  isLoading: boolean;
  messages: Messages;
  onMarkPaid: () => void;
  payment: PaymentRecord;
}) {
  return (
    <div className="rounded-xl border border-subtle bg-input p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-primary">{payment.customerName || "-"}</p>
          <p className="mt-1 text-sm text-muted">{payment.serviceName || "-"}</p>
        </div>
        <PaymentStatusBadge messages={messages} status={payment.status} />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted">
        <PaymentDetail label={messages.payments.date} value={`${formatPaymentDate(payment.date)} · ${payment.startTime}`} />
        <PaymentDetail label={messages.payments.professional} value={payment.employeeName || "-"} />
        <PaymentDetail label={messages.payments.method} value={messages.paymentMethods[payment.method]} />
        <PaymentDetail label={messages.payments.amount} value={formatCurrency(payment.amount)} />
        <PaymentDetail label={messages.payments.contact} value={formatPhoneForDisplay(payment.customerPhone) || payment.customerEmail || "-"} />
      </div>
      <div className="mt-4">
        <PaymentAction messages={messages} payment={payment} isLoading={isLoading} onMarkPaid={onMarkPaid} />
      </div>
    </div>
  );
}

function PaymentAction({
  isLoading,
  messages,
  onMarkPaid,
  payment
}: {
  isLoading: boolean;
  messages: Messages;
  onMarkPaid: () => void;
  payment: PaymentRecord;
}) {
  if (payment.status !== "pending") {
    return (
      <Button size="sm" variant="secondary" disabled className={`${payment.status == "cancelled" ? "!bg-red-600 text-white": undefined}`}>
        {payment.status === "paid" ? messages.payments.alreadyPaid : messages.payments.statuses[payment.status]}
      </Button>
    );
  }

  return (
    <Button size="sm" className="whitespace-nowrap bg-success px-3 text-white hover:bg-success-soft hover:text-success" isLoading={isLoading} onClick={onMarkPaid}>
      {messages.payments.markAsPaid}
    </Button>
  );
}

function PaymentStatusBadge({ messages, status }: { messages: Messages; status: PaymentStatus }) {
  return <Badge tone={statusToneMap[status]}>{messages.payments.statuses[status]}</Badge>;
}

function PaymentDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <strong className="text-right text-primary">{value}</strong>
    </div>
  );
}

function PaymentsState({ title, description }: { title: ReactNode; description?: string }) {
  return (
    <div className="grid min-h-56 place-items-center p-6 text-center">
      <div>
        <h2 className="text-lg font-bold text-primary">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-muted">{description}</p> : null}
      </div>
    </div>
  );
}

function formatPaymentDate(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatPhoneForDisplay(value: string) {
  return value.replace(/\s+/g, "");
}
