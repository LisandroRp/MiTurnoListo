"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { FiArrowRight, FiChevronDown, FiClock, FiSearch, FiUserCheck, FiUsers } from "react-icons/fi";

import { PublicBusinessHeader } from "@/features/booking-flow/components/PublicBusinessHeader";
import { BrandMark } from "@/components/composed/BrandMark";
import { FormattedText } from "@/components/ui/FormattedText";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { cx } from "@/components/ui/utils";
import { Messages, messages as schedulingMessages } from "@/features/scheduling/i18n/messages";
import { getProfessionalLabel, getServiceTitleOverflowClass } from "@/features/booking-flow/utils/catalog";
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
  const [professionalFilter, setProfessionalFilter] = useState("");
  const locale = payload?.locale ?? "es";
  const messages = schedulingMessages[locale];
  const theme = payload?.theme ?? "coral";
  const normalizedSearchQuery = normalizeCatalogSearch(searchQuery);
  const professionalNames = [...new Set(payload?.services.flatMap((service) => service.employeeNames) ?? [])].sort((a, b) => a.localeCompare(b, locale));
  const filteredServices = payload?.services.filter((service) => matchesCatalogSearch(service, normalizedSearchQuery) && (!professionalFilter || service.employeeNames.includes(professionalFilter))) ?? [];
  const businessSlug = payload?.businessSlug || businessId;

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
            <Link href="/" className="hidden absolute left-0 top-0 md:block" aria-label="Ir al inicio">
              <BrandMark variant="full" size="md" />
            </Link>
            <Link href="/" className="absolute left-0 top-0 md:hidden" aria-label="Ir al inicio">
              <BrandMark variant="compact" size="md" />
            </Link>
            <LoadingState title={messages.publicServices.loadingTitle} dotCount={loadingDotCount} />
          </div>
        ) : (
          <PublicBusinessHeader
            catalogHref={`/${businessSlug}`}
            businessName={payload?.businessName ?? messages.appName}
            logoUrl={payload?.publicLogoUrl}
            description={payload?.publicDescription}
            address={payload?.address}
            openingHours={payload?.publicOpeningHours}
          />
        )}

        {isLoading ? null : errorMessage ? (
          <StateCard title={messages.publicServices.loadError} description={errorMessage} />
        ) : payload && payload.services.length > 0 ? (
          <>
            <div className="grid gap-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-xl font-bold text-primary sm:text-2xl">{messages.publicServices.servicesTitle}</h2>
                <p className="text-sm text-muted" aria-live="polite">{filteredServices.length} {messages.publicServices.resultsLabel}</p>
              </div>
              <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_18rem]">
                <TextField
                  label={messages.publicServices.searchLabel}
                  prefix={<FiSearch aria-hidden="true" />}
                  placeholder={messages.publicServices.searchPlaceholder}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <SelectField
                  label={messages.publicServices.professionalFilter}
                  value={professionalFilter}
                  onChange={(event) => setProfessionalFilter(event.target.value)}
                  options={[
                    { value: "", label: messages.publicServices.allProfessionals },
                    ...professionalNames.map((name) => ({ value: name, label: name }))
                  ]}
                />
              </div>
            </div>

            {filteredServices.length > 0 ? (
              <section className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredServices.map((service) => (
                  <PublicServiceCard key={service.id} businessSlug={businessSlug} messages={messages} service={service} />
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

export function PublicServiceCard({
  businessSlug,
  messages,
  service
}: {
  businessSlug: string;
  messages: Messages;
  service: PublicServiceSummary;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const descriptionId = useId();
  const description = service.description.trim();

  return (
    <Card className="group flex min-w-0 flex-col gap-4 transition-all duration-200 hover:border-brand hover:shadow-md motion-reduce:transition-none">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3 className={cx("min-w-0 text-lg font-bold leading-snug text-primary sm:text-xl", getServiceTitleOverflowClass(service.name))}>
            <Link href={`/${businessSlug}/${service.publicSlug || service.id}`} className="rounded-sm outline-none hover:text-brand-strong focus-visible:ring-2 focus-visible:ring-focus">
              {service.name}
            </Link>
          </h3>
          {description ? (
            <button
              type="button"
              aria-label={`${isExpanded ? messages.publicServices.hideDescription : messages.publicServices.showDescription}: ${service.name}`}
              aria-expanded={isExpanded}
              aria-controls={descriptionId}
              onClick={() => setIsExpanded((current) => !current)}
              className="ml-auto grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-brand-strong transition-colors hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <FiChevronDown className={cx("transition-transform duration-300 motion-reduce:transition-none", isExpanded ? "rotate-180" : "")} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {description ? (
          <div id={descriptionId} className={cx("grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none", isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")} inert={!isExpanded}>
            <div className="min-h-0 overflow-hidden">
              <FormattedText className="pt-2 text-sm leading-6 text-muted" value={description} />
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5" title={messages.services.duration}>
            <FiClock className="shrink-0 text-brand-strong" aria-hidden="true" />
            {service.durationMinutes} {messages.services.minutes}
          </span>
          {service.capacity > 1 ? (
            <span className="inline-flex items-center gap-1.5" title={messages.services.capacity}>
              <FiUsers className="shrink-0 text-brand-strong" aria-hidden="true" />
              {formatPeopleCount(service.capacity, messages)}
            </span>
          ) : null}
        </div>
        {!service.hidePricePublicly ? <p className="text-lg font-bold text-primary" aria-label={`${messages.services.price}: ${formatCurrency(service.price)}`}>{formatCurrency(service.price)}</p> : null}
      </div>
      {service.employeeNames.length > 0 ? (
        <div className="border-t border-subtle pt-3">
          <EmployeeFact label={getProfessionalLabel(service.employeeNames.length, messages)} names={service.employeeNames} />
        </div>
      ) : null}
      <Link
        href={`/${businessSlug}/${service.publicSlug || service.id}`}
        aria-label={`${messages.publicServices.bookAction}: ${service.name}`}
        className="mt-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus !text-white"
      >
        {messages.publicServices.bookAction}
        <FiArrowRight aria-hidden="true" />
      </Link>
    </Card>
  );
}

function EmployeeFact({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div className="flex min-w-0 items-start gap-2 text-sm">
      <FiUserCheck className="mt-0.5 shrink-0 text-brand-strong" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-1 break-words font-medium leading-5 text-primary">{names.join(" · ")}</p>
      </div>
    </div>
  );
}

function formatPeopleCount(count: number, messages: Messages) {
  return `${count} ${count === 1 ? messages.services.person : messages.services.people}`;
}

function StateCard({ title, description }: { title: string; description?: string }) {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <h2 className="text-2xl font-bold text-primary">{title}</h2>
      {description ? <p className="mt-3 text-sm leading-6 text-muted">{description}</p> : null}
    </Card>
  );
}
