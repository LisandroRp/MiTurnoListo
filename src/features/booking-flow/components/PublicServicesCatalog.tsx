"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { FiClock, FiMapPin, FiSearch, FiShield, FiUserCheck, FiUsers } from "react-icons/fi";

import { BrandMark } from "@/components/composed/BrandMark";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
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
  const [searchQuery, setSearchQuery] = useState("");
  const locale = payload?.locale ?? "es";
  const messages = schedulingMessages[locale];
  const theme = payload?.theme ?? "coral";
  const normalizedSearchQuery = normalizeCatalogSearch(searchQuery);
  const filteredServices = payload?.services.filter((service) => matchesCatalogSearch(service, normalizedSearchQuery)) ?? [];

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
      <div className="mx-auto grid max-w-7xl gap-8">
        {isLoading ? (
          <div className="relative min-h-screen">
            <div className="hidden absolute left-0 top-0 md:block">
              <BrandMark variant="full" size="md" />
            </div>
            <div className="absolute left-0 top-0 md:hidden">
              <BrandMark variant="compact" size="md" />
            </div>
            <LoadingState title={messages.publicServices.loadingTitle} dotCount={loadingDotCount} />
          </div>
        ) : (
          <header className="relative grid justify-items-center gap-4 pt-8 text-center md:pt-0">
            <div className="hidden absolute left-0 top-0 md:block">
              <BrandMark variant="full" size="md" />
            </div>
            <div className="absolute left-0 top-0 md:hidden">
              <BrandMark variant="compact" size="md" />
            </div>
            <div>
              {payload?.publicLogoUrl ? (
                <div
                  className="mx-auto grid h-36 w-36 place-items-center rounded-3xl bg-contain bg-center bg-no-repeat text-lg font-bold text-primary"
                  style={{ backgroundImage: `url(${payload.publicLogoUrl})` }}
                  aria-label={payload.businessName}
                />
              ) : (
                <h1 className="mt-3 text-4xl font-bold text-primary">{payload?.businessName ?? messages.appName}</h1>
              )}
              {payload?.address ? (
                <div className="mt-3 flex items-center justify-center gap-2 text-base font-semibold text-muted">
                  <FiMapPin className="shrink-0 text-brand-strong" aria-hidden="true" />
                  <span>{payload.address}</span>
                </div>
              ) : null}
              {payload?.publicOpeningHours ? (
                <div className="mt-3 flex items-start justify-center gap-2 text-sm leading-6 text-muted">
                  <FiClock className="mt-0.5 shrink-0 text-brand-strong" aria-hidden="true" />
                  <span className="whitespace-pre-line">{payload.publicOpeningHours}</span>
                </div>
              ) : null}
            </div>
          </header>
        )}

        {isLoading ? null : errorMessage ? (
          <StateCard title={messages.publicServices.loadError} description={errorMessage} />
        ) : payload && payload.services.length > 0 ? (
          <>
            <div className="w-full max-w-2xl">
              <TextField
                prefix={<FiSearch aria-hidden="true" />}
                placeholder={messages.publicServices.searchPlaceholder}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            {filteredServices.length > 0 ? (
              <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
                {filteredServices.map((service) => (
                  <PublicServiceCard key={service.id} messages={messages} service={service} />
                ))}
              </section>
            ) : (
              <StateCard title={messages.publicServices.noSearchResultsTitle} description={messages.publicServices.noSearchResultsDescription} />
            )}
          </>
        ) : (
          <StateCard title={messages.publicServices.emptyTitle} description={messages.publicServices.emptyDescription} />
        )}
      </div>
    </main>
  );
}

function normalizeCatalogSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

function matchesCatalogSearch(service: PublicServiceSummary, normalizedSearchQuery: string) {
  if (!normalizedSearchQuery) {
    return true;
  }

  const searchableText = [
    service.name,
    service.description,
    ...service.employeeNames
  ].join(" ");

  return normalizeCatalogSearch(searchableText).includes(normalizedSearchQuery);
}

function LoadingState({ title, dotCount }: { title: string; dotCount: number }) {
  return (
    <div className="grid min-h-full place-items-center text-center">
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
    <Link href={`/reservar/${service.publicSlug || service.id}`} className="group block h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-focus">
      <Card className="flex h-full flex-col gap-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:border-brand group-hover:shadow-lg group-focus-visible:border-brand group-focus-visible:shadow-lg">
        <div className="flex flex-1 flex-col gap-5">
          <div>
            <h2 className="text-2xl font-bold text-primary">{service.name}</h2>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{service.description || messages.services.emptyDescription}</p>
          </div>

          <div className="grid gap-3 text-sm">
            <EmployeeFact icon={<FiUserCheck />} label={messages.services.professionalsColumn} names={service.employeeNames} />
            <CatalogFact icon={<FiShield />} label={messages.services.price} value={formatCurrency(service.price)} />
            <CatalogFact icon={<FiClock />} label={messages.services.duration} value={`${service.durationMinutes} ${messages.services.minutes}`} />
            {service.capacity > 1 ? (
              <CatalogFact icon={<FiUsers />} label={messages.services.capacity} value={formatPeopleCount(service.capacity, messages)} />
            ) : null}
          </div>

          <div className="mt-auto">
            <span className="inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-brand px-5 text-base font-semibold text-on-brand shadow-sm transition-colors group-hover:bg-brand-hover">
              {messages.publicServices.bookAction}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function EmployeeFact({ icon, label, names }: { icon: ReactNode; label: string; names: string[] }) {
  if (names.length === 0) {
    return null;
  }

  const visibleNames = names.slice(0, 2);
  const hiddenCount = Math.max(names.length - visibleNames.length, 0);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-subtle bg-input p-3">
      <span className="text-brand-strong" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-muted">{label}</p>
        <div className="mt-2 flex flex-nowrap gap-2 overflow-hidden">
          {visibleNames.map((name) => (
            <span key={name} className="min-w-0 truncate rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
              {name}
            </span>
          ))}
          {hiddenCount > 0 ? (
            <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
              +{hiddenCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatPeopleCount(count: number, messages: Messages) {
  return `${count} ${count === 1 ? messages.services.person : messages.services.people}`;
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
