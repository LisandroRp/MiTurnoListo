"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { FiClock, FiShield, FiUsers } from "react-icons/fi";

import { BrandMark } from "@/components/composed/BrandMark";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";
import { Messages, messages as schedulingMessages } from "@/features/scheduling/i18n/messages";
import { formatCurrency } from "@/features/scheduling/utils/format";
import {
  getPublicServicesPayload,
  PublicServicesPayload,
  PublicServiceSummary
} from "@/lib/networking/endpoints/public-services";
import { getPayloadErrorMessage } from "@/lib/networking/response-errors";

type PublicServicesCatalogProps = {
  businessId: string;
};

export function PublicServicesCatalog({ businessId }: PublicServicesCatalogProps) {
  const [payload, setPayload] = useState<PublicServicesPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingDotCount, setLoadingDotCount] = useState(1);
  const locale = payload?.locale ?? "es";
  const messages = schedulingMessages[locale];
  const theme = payload?.theme ?? "coral";

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingDotCount((currentCount) => currentCount % 3 + 1);
    }, 450);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLoading]);

  useEffect(() => {
    let isActive = true;

    void getPublicServicesPayload(businessId)
      .then((nextPayload) => {
        if (isActive) {
          setPayload(nextPayload);
          setErrorMessage("");
        }
      })
      .catch((error) => {
        if (isActive) {
          setErrorMessage(getPayloadErrorMessage(error, schedulingMessages.es.publicServices.loadError));
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
  }, [businessId]);

  return (
    <main className={cx(`theme-${theme} text-primary`, "min-h-screen bg-page px-4 py-8 sm:px-6 lg:px-8")}>
      <div className="mx-auto grid max-w-6xl gap-8">
        <header className="grid justify-items-center gap-4 text-center">
          <BrandMark variant="full" size="md" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">{messages.publicServices.eyebrow}</p>
            <h1 className="mt-3 text-4xl font-bold text-primary">{payload?.businessName ?? messages.appName}</h1>
            <p className="mt-3 text-base leading-7 text-muted">{messages.publicServices.description}</p>
          </div>
        </header>

        {isLoading ? (
          <LoadingState title={messages.publicServices.loadingTitle} dotCount={loadingDotCount} />
        ) : errorMessage ? (
          <StateCard title={messages.publicServices.loadError} description={errorMessage} />
        ) : payload && payload.services.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {payload.services.map((service) => (
              <PublicServiceCard key={service.id} messages={messages} service={service} />
            ))}
          </section>
        ) : (
          <StateCard title={messages.publicServices.emptyTitle} description={messages.publicServices.emptyDescription} />
        )}
      </div>
    </main>
  );
}

function LoadingState({ title, dotCount }: { title: string; dotCount: number }) {
  return (
    <div className="grid min-h-[45vh] place-items-center text-center">
      <Card className="w-full max-w-sm">
        <p className="text-lg font-semibold text-primary" aria-live="polite">
          {title}
          <span className="inline-block w-5 text-left">{".".repeat(dotCount)}</span>
        </p>
      </Card>
    </div>
  );
}

function PublicServiceCard({
  messages,
  service
}: {
  messages: Messages;
  service: PublicServiceSummary;
}) {
  return (
    <Card className="flex h-full flex-col gap-5">
      <div
        className="min-h-44 rounded-2xl bg-surface-strong bg-cover bg-center"
        style={{ backgroundImage: service.imageUrl ? `url(${service.imageUrl})` : undefined }}
        aria-label={service.imageUrl ? service.name : undefined}
      />

      <div className="flex flex-1 flex-col gap-5">
        <div>
          <Badge tone="brand">{messages.bookingFlow.steps.service}</Badge>
          <h2 className="mt-3 text-2xl font-bold text-primary">{service.name}</h2>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{service.description || messages.services.emptyDescription}</p>
        </div>

        <div className="grid gap-3 text-sm">
          <CatalogFact icon={<FiShield />} label={messages.services.price} value={formatCurrency(service.price)} />
          <CatalogFact icon={<FiClock />} label={messages.services.duration} value={`${service.durationMinutes} ${messages.services.minutes}`} />
          <CatalogFact icon={<FiUsers />} label={messages.services.capacity} value={`${service.capacity} ${messages.services.people}`} />
        </div>

        <div className="mt-auto">
          <Link
            href={`/reservar/${service.id}`}
            className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-brand px-5 text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
          >
            {messages.publicServices.bookAction}
          </Link>
        </div>
      </div>
    </Card>
  );
}

function CatalogFact({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-subtle bg-input p-3">
      <span className="text-brand-strong" aria-hidden="true">{icon}</span>
      <div>
        <p className="text-xs font-semibold uppercase text-muted">{label}</p>
        <p className="mt-1 font-bold text-primary">{value}</p>
      </div>
    </div>
  );
}

function StateCard({ title, description }: { title: string; description?: string }) {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <h2 className="text-2xl font-bold text-primary">{title}</h2>
      {description ? <p className="mt-3 text-sm leading-6 text-muted">{description}</p> : null}
    </Card>
  );
}
