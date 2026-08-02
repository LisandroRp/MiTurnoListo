"use client";

import { useEffect, useState } from "react";

import { BrandMark } from "@/components/composed/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/features/scheduling/utils/format";

type CancellationDetails = {
  appointmentId: string;
  businessName: string;
  canCancel: boolean;
  cancelUntil: string;
  cancellationLeadMinutes: number;
  cannotCancelReason: string;
  customerName: string;
  employeeName: string;
  refundedAt: string | null;
  serviceName: string;
  startsAt: string;
  status: string;
  timeZone: string;
  totalAmount: number;
  wasPaidWithMercadoPago: boolean;
};

export function PublicAppointmentCancellation({ token }: { token: string }) {
  const [details, setDetails] = useState<CancellationDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    setErrorMessage("");

    void fetch(`/api/public-cancellation/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as CancellationDetails | { error?: string } | null;

        if (!response.ok) {
          throw new Error(payload && "error" in payload && payload.error ? payload.error : "No pudimos cargar el turno.");
        }

        return payload as CancellationDetails;
      })
      .then((payload) => {
        if (isActive) {
          setDetails(payload);
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(error instanceof Error ? error.message : "No pudimos cargar el turno.");
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
  }, [token]);

  async function cancelAppointment() {
    setIsCancelling(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(`/api/public-cancellation/${encodeURIComponent(token)}`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => null) as { error?: string; wasRefunded?: boolean } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "No pudimos cancelar el turno.");
      }

      setDetails((current) => current ? { ...current, canCancel: false, status: "cancelled", refundedAt: payload?.wasRefunded ? new Date().toISOString() : current.refundedAt } : current);
      setSuccessMessage(payload?.wasRefunded ? "Turno cancelado. Solicitamos el reembolso en Mercado Pago." : "Turno cancelado correctamente.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No pudimos cancelar el turno.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main className="min-h-screen bg-app px-4 py-10 text-primary">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-2xl place-items-center">
        <Card className="w-full p-6 sm:p-8">
          {isLoading ? (
            <div className="grid gap-3 text-center">
              <h1 className="text-2xl font-bold text-primary">Cargando turno...</h1>
              <p className="text-sm text-muted">Estamos buscando la reserva para validar si se puede cancelar.</p>
            </div>
          ) : errorMessage && !details ? (
            <div className="grid gap-3 text-center">
              <h1 className="text-2xl font-bold text-primary">No pudimos cargar el turno</h1>
              <p className="text-sm text-danger">{errorMessage}</p>
            </div>
          ) : details ? (
            <div className="grid gap-6">
              <div className="grid justify-items-center text-center">
                <BrandMark variant="full" size="lg"/>
                <p className="text-xs mt-3 font-bold uppercase tracking-[0.24em] text-muted">{details.businessName}</p>
                <h1 className="mt-3 text-3xl font-bold text-primary">Cancelar turno</h1>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Revisa los datos antes de confirmar la cancelacion.
                </p>
              </div>

              <div className="grid gap-3 rounded-2xl border border-subtle bg-input p-4 text-sm">
                <DetailRow label="Servicio" value={details.serviceName} />
                <DetailRow label="Profesional" value={details.employeeName || "-"} />
                <DetailRow label="Cliente" value={details.customerName || "-"} />
                <DetailRow label="Fecha" value={formatDateTime(details.startsAt, details.timeZone)} />
                <DetailRow label="Total" value={formatCurrency(details.totalAmount)} />
              </div>

              <div className="rounded-2xl border border-subtle bg-surface p-4 text-sm leading-6 text-muted">
                {details.canCancel ? (
                  <p>
                    Este turno se puede cancelar hasta {formatDateTime(details.cancelUntil, details.timeZone)}.
                    {details.wasPaidWithMercadoPago ? " Si fue pagado por Mercado Pago, vamos a solicitar el reembolso automaticamente." : ""}
                  </p>
                ) : (
                  <p>{details.status === "cancelled" ? "Este turno ya fue cancelado." : details.cannotCancelReason}</p>
                )}
              </div>

              {successMessage ? (
                <div className="rounded-2xl border border-success bg-success-soft p-4 text-sm font-semibold text-success">
                  {successMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-2xl border border-danger bg-danger-soft p-4 text-sm font-semibold text-danger">
                  {errorMessage}
                </div>
              ) : null}

              <Button
                size="lg"
                variant={details.canCancel ? "danger" : "secondary"}
                isLoading={isCancelling}
                disabled={!details.canCancel}
                onClick={() => void cancelAppointment()}
              >
                {details.status === "cancelled" ? "Turno cancelado" : "Cancelar turno"}
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="font-semibold text-muted">{label}</span>
      <span className="text-right font-bold text-primary">{value}</span>
    </div>
  );
}

function formatDateTime(dateTime: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone
  }).format(new Date(dateTime));
}
