import Link from "next/link";

import { BrandMark } from "@/components/composed/BrandMark";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { confirmMercadoPagoAppointmentPayment } from "@/lib/mercadopago/checkout";

type BookingResultPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookingResultPage({ searchParams }: BookingResultPageProps) {
  const params = await searchParams;
  const appointmentId = getSearchParam(params, "appointmentId") ?? getSearchParam(params, "external_reference");
  const paymentId = getSearchParam(params, "payment_id") ?? getSearchParam(params, "collection_id");
  const paymentStatus = getSearchParam(params, "status") ?? getSearchParam(params, "collection_status");
  const result = appointmentId && paymentId
    ? await confirmMercadoPagoAppointmentPayment({ appointmentId, paymentId })
    : null;
  const view = getResultView(result?.status ?? paymentStatus ?? "missing");

  return (
    <main className="theme-coral grid min-h-screen place-items-center bg-page px-4 py-8 text-primary">
      <Card className="grid w-full max-w-xl justify-items-center gap-5 text-center">
        <BrandMark variant="full" size="md" align="center" priority />
        <Badge tone={view.tone}>{view.badge}</Badge>
        <div>
          <h1 className="text-3xl font-bold text-primary">{view.title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{view.description}</p>
        </div>
        <Link
          href="/"
          className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
        >
          Volver al inicio
        </Link>
      </Card>
    </main>
  );
}

function getSearchParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];

  return Array.isArray(value) ? value[0] : value;
}

function getResultView(status: string) {
  if (status === "approved") {
    return {
      badge: "Pago aprobado",
      description: "Confirmamos el pago en Mercado Pago y tu turno quedo confirmado.",
      title: "Turno confirmado",
      tone: "success" as const
    };
  }

  if (status === "pending" || status === "in_process") {
    return {
      badge: "Pago pendiente",
      description: "Mercado Pago todavia esta procesando el pago. El turno queda pendiente hasta que se apruebe.",
      title: "Tu pago esta pendiente",
      tone: "warning" as const
    };
  }

  if (status === "rejected" || status === "failure") {
    return {
      badge: "Pago rechazado",
      description: "No pudimos confirmar el pago. Puedes intentar reservar nuevamente o elegir otro metodo de pago.",
      title: "El pago no fue aprobado",
      tone: "danger" as const
    };
  }

  return {
    badge: "No confirmado",
    description: "No pudimos verificar el pago con Mercado Pago. Si el cobro se realizo, contacta al negocio para revisarlo.",
    title: "No pudimos confirmar el turno",
    tone: "neutral" as const
  };
}
