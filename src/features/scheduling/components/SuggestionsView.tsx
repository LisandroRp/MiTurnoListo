"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FiMessageSquare, FiRefreshCw, FiShield } from "react-icons/fi";

import { SectionHeader } from "@/components/composed/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { Messages } from "@/features/scheduling/i18n/messages";
import {
  featureSuggestionDescriptionMaxLength,
  featureSuggestionTitleMaxLength,
  type FeatureSuggestionStatus
} from "@/lib/feature-suggestions";
import {
  FeatureSuggestion,
  FeatureSuggestionRequestError,
  getFeatureSuggestionAvailability,
  getSuperAdminFeatureSuggestions,
  submitFeatureSuggestion,
  updateFeatureSuggestionStatus
} from "@/lib/networking/endpoints/feature-suggestions";
import { getSuperAdminStatus } from "@/lib/networking/endpoints/super-admin";

type SuggestionsViewProps = {
  businessId: string | null;
  locale: "es" | "en";
  messages: Messages;
};

export function SuggestionsView({ businessId, locale, messages }: SuggestionsViewProps) {
  const copy = messages.suggestions;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [canSubmitToday, setCanSubmitToday] = useState<boolean | null>(null);
  const [submittedToday, setSubmittedToday] = useState<FeatureSuggestion | null>(null);
  const [availabilityError, setAvailabilityError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [hasLoadedAdminSuggestions, setHasLoadedAdminSuggestions] = useState(false);
  const [isLoadingAdminSuggestions, setIsLoadingAdminSuggestions] = useState(false);
  const [adminSuggestions, setAdminSuggestions] = useState<FeatureSuggestion[]>([]);
  const [adminError, setAdminError] = useState("");
  const [adminStatusFilter, setAdminStatusFilter] = useState<"all" | FeatureSuggestionStatus>("pending");
  const [updatingSuggestionId, setUpdatingSuggestionId] = useState("");
  const visibleAdminSuggestions = useMemo(() => (
    adminStatusFilter === "all"
      ? adminSuggestions
      : adminSuggestions.filter((suggestion) => suggestion.status === adminStatusFilter)
  ), [adminStatusFilter, adminSuggestions]);

  useEffect(() => {
    let isActive = true;

    void getSuperAdminStatus()
      .then((value) => {
        if (isActive) setIsSuperAdmin(value);
      })
      .catch(() => {
        if (isActive) setIsSuperAdmin(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!businessId) {
      return;
    }

    let isActive = true;
    setCanSubmitToday(null);
    setAvailabilityError("");

    void getFeatureSuggestionAvailability(businessId)
      .then((availability) => {
        if (!isActive) return;
        setCanSubmitToday(availability.canSubmitToday);
        setSubmittedToday(availability.submittedToday);
      })
      .catch(() => {
        if (!isActive) return;
        setCanSubmitToday(false);
        setAvailabilityError(copy.availabilityError);
      });

    return () => {
      isActive = false;
    };
  }, [businessId, copy.availabilityError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!businessId || !canSubmitToday || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const suggestion = await submitFeatureSuggestion(businessId, title, description);
      setSubmittedToday(suggestion);
      setCanSubmitToday(false);
      setTitle("");
      setDescription("");
      setHasLoadedAdminSuggestions(false);
    } catch (error) {
      if (error instanceof FeatureSuggestionRequestError && error.code === "FEATURE_SUGGESTION_DAILY_LIMIT") {
        setCanSubmitToday(false);
        setSubmitError(copy.dailyLimit);
      } else {
        setSubmitError(copy.submitError);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOpenAdminPanel() {
    const nextIsOpen = !isAdminPanelOpen;
    setIsAdminPanelOpen(nextIsOpen);

    if (!nextIsOpen || hasLoadedAdminSuggestions || isLoadingAdminSuggestions) {
      return;
    }

    await loadAdminSuggestions();
  }

  async function loadAdminSuggestions() {
    setIsLoadingAdminSuggestions(true);
    setAdminError("");

    try {
      const suggestions = await getSuperAdminFeatureSuggestions();
      setAdminSuggestions(suggestions);
      setHasLoadedAdminSuggestions(true);
    } catch {
      setAdminError(copy.adminError);
    } finally {
      setIsLoadingAdminSuggestions(false);
    }
  }

  async function handleUpdateSuggestionStatus(id: string, status: FeatureSuggestionStatus) {
    if (updatingSuggestionId) {
      return;
    }

    setUpdatingSuggestionId(id);
    setAdminError("");

    try {
      const updatedSuggestion = await updateFeatureSuggestionStatus(id, status);
      setAdminSuggestions((current) => current.map((suggestion) => (
        suggestion.id === updatedSuggestion.id
          ? {
              ...suggestion,
              reviewedAt: updatedSuggestion.reviewedAt,
              status: updatedSuggestion.status
            }
          : suggestion
      )));
    } catch {
      setAdminError(copy.statusUpdateError);
    } finally {
      setUpdatingSuggestionId("");
    }
  }

  return (
    <div className="grid gap-6">
      <SectionHeader
        icon={<FiMessageSquare />}
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={isSuperAdmin ? (
          <Button
            variant="secondary"
            icon={<FiShield />}
            onClick={() => void handleOpenAdminPanel()}
          >
            {isAdminPanelOpen ? copy.closeAdminPanel : copy.openAdminPanel}
          </Button>
        ) : null}
      />

      <Card className="grid gap-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-xl text-brand-strong">
            <FiMessageSquare aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-primary">{copy.formTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{copy.formDescription}</p>
          </div>
        </div>

        {submittedToday || (canSubmitToday === false && !availabilityError) ? (
          <div className="rounded-lg border border-success bg-success-soft p-4" role="status">
            <p className="font-semibold text-success">{copy.submittedTitle}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{copy.dailyLimit}</p>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <TextField
              label={copy.suggestionTitle}
              maxLength={featureSuggestionTitleMaxLength}
              minLength={3}
              placeholder={copy.suggestionTitlePlaceholder}
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <TextAreaField
              label={copy.suggestionDescription}
              className="min-h-40"
              maxLength={featureSuggestionDescriptionMaxLength}
              minLength={10}
              placeholder={copy.suggestionDescriptionPlaceholder}
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted">{copy.textOnlyHint}</p>
              <Button
                type="submit"
                isLoading={isSubmitting}
                disabled={!businessId || canSubmitToday !== true}
              >
                {copy.submit}
              </Button>
            </div>
          </form>
        )}

        {availabilityError ? (
          <p className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger" role="alert">
            {availabilityError}
          </p>
        ) : null}
        {submitError ? <p className="text-sm font-semibold text-danger" role="alert">{submitError}</p> : null}
      </Card>

      {isSuperAdmin && isAdminPanelOpen ? (
        <Card className="grid gap-5">
          <div>
            <div>
              <h2 className="text-lg font-bold text-primary">{copy.adminTitle}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{copy.adminDescription}</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-end sm:justify-between">
              <SelectField
                label={copy.statusFilter}
                value={adminStatusFilter}
                onChange={(event) => setAdminStatusFilter(event.target.value as "all" | FeatureSuggestionStatus)}
                options={[
                  { value: "pending", label: copy.statusPending },
                  { value: "done", label: copy.statusDone },
                  { value: "rejected", label: copy.statusRejected },
                  { value: "all", label: copy.statusAll }
                ]}
              />
              <Button
                variant="ghost"
                icon={<FiRefreshCw />}
                isLoading={isLoadingAdminSuggestions}
                onClick={() => void loadAdminSuggestions()}
              >
                {copy.refresh}
              </Button>
            </div>
          </div>

          {adminError ? (
            <p className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger" role="alert">
              {adminError}
            </p>
          ) : isLoadingAdminSuggestions && !hasLoadedAdminSuggestions ? (
            <div className="grid gap-3" aria-label={copy.adminLoading} aria-busy="true">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-28 animate-pulse rounded-lg bg-surface-strong" />
              ))}
            </div>
          ) : adminSuggestions.length === 0 ? (
            <p className="rounded-lg border border-subtle bg-input p-4 text-sm text-muted">{copy.adminEmpty}</p>
          ) : visibleAdminSuggestions.length === 0 ? (
            <p className="rounded-lg border border-subtle bg-input p-4 text-sm text-muted">{copy.adminFilterEmpty}</p>
          ) : (
            <div className="grid gap-3">
              {visibleAdminSuggestions.map((suggestion) => (
                <article key={suggestion.id} className="rounded-lg border border-subtle bg-input p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-primary">{suggestion.title}</h3>
                        <Badge tone={getSuggestionStatusTone(suggestion.status)}>
                          {getSuggestionStatusLabel(suggestion.status, copy)}
                        </Badge>
                      </div>
                      <p className="mt-1 break-words text-sm leading-6 text-muted">{suggestion.description}</p>
                    </div>
                    <time className="shrink-0 text-xs font-semibold text-muted" dateTime={suggestion.createdAt}>
                      {formatSuggestionDate(suggestion.createdAt, locale)}
                    </time>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-subtle pt-3 text-xs text-muted">
                    <span><strong className="text-primary">{copy.business}:</strong> {suggestion.businessName}</span>
                    <span><strong className="text-primary">{copy.user}:</strong> {suggestion.submittedByEmail}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {suggestion.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          isLoading={updatingSuggestionId === suggestion.id}
                          disabled={Boolean(updatingSuggestionId)}
                          // className="bg-success text-white"
                          onClick={() => void handleUpdateSuggestionStatus(suggestion.id, "done")}
                        >
                          {copy.markDone}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={Boolean(updatingSuggestionId)}
                          onClick={() => void handleUpdateSuggestionStatus(suggestion.id, "rejected")}
                        >
                          {copy.reject}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={updatingSuggestionId === suggestion.id}
                        disabled={Boolean(updatingSuggestionId)}
                        onClick={() => void handleUpdateSuggestionStatus(suggestion.id, "pending")}
                      >
                        {copy.reopen}
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function getSuggestionStatusLabel(status: FeatureSuggestionStatus, copy: Messages["suggestions"]) {
  if (status === "done") return copy.statusDone;
  if (status === "rejected") return copy.statusRejected;
  return copy.statusPending;
}

function getSuggestionStatusTone(status: FeatureSuggestionStatus): "success" | "warning" | "danger" {
  if (status === "done") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function formatSuggestionDate(value: string, locale: "es" | "en") {
  return new Intl.DateTimeFormat(locale === "es" ? "es-AR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
