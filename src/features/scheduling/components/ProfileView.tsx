import { useRef, useState } from "react";
import { FiCheckCircle, FiLock, FiX, FiZap } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Locale, Profile, SubscriptionTier, ThemeId } from "@/features/scheduling/types";

type ProfileViewProps = {
  messages: Messages;
  profile: Profile;
  locale: Locale;
  theme: ThemeId;
  themeOptions: ThemeId[];
  onRequestPasswordReset: (email: string) => Promise<void>;
  onLocaleChange: (locale: Locale) => void;
  onThemeChange: (theme: ThemeId) => void;
  onSubscriptionTierChange: (tier: SubscriptionTier) => void;
};

export function ProfileView({
  messages,
  profile,
  locale,
  theme,
  themeOptions,
  onRequestPasswordReset,
  onLocaleChange,
  onThemeChange,
  onSubscriptionTierChange
}: ProfileViewProps) {
  const plansRef = useRef<HTMLDivElement>(null);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] = useState(false);
  const isProPlan = profile.subscriptionTier === "pro";

  function scrollToPlans() {
    plansRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handlePlanClick(targetTier: SubscriptionTier) {
    if (targetTier === profile.subscriptionTier) {
      return;
    }

    setPendingTier(targetTier);
  }

  function closeModal() {
    setPendingTier(null);
  }

  function confirmPlanChange() {
    if (!pendingTier) {
      return;
    }

    onSubscriptionTierChange(pendingTier);
    closeModal();
  }

  async function handlePasswordReset() {
    if (!profile.email) {
      return;
    }

    setIsRequestingPasswordReset(true);
    await onRequestPasswordReset(profile.email);
    setIsRequestingPasswordReset(false);
  }

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow={messages.profile.eyebrow}
        title={messages.profile.title}
        description={messages.profile.description}
      />

      <section className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <Card className="h-fit">
          <div
            className="mx-auto h-28 w-28 rounded-full border border-subtle bg-surface-strong bg-cover bg-center"
            style={{ backgroundImage: `url(${profile.avatarUrl})` }}
          />
          <div className="mt-4 text-center">
            <h2 className="text-xl font-bold text-primary">{profile.firstName} {profile.lastName}</h2>
            <p className="text-sm text-muted">{profile.email}</p>
          </div>
          <button
            type="button"
            onClick={scrollToPlans}
            className="mt-6 w-full cursor-pointer rounded-lg bg-brand-soft p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-sm"
          >
            <p className="text-xs font-semibold text-brand-strong">{messages.profile.plan}</p>
            <p className="mt-1 text-lg font-bold text-primary">{isProPlan ? messages.profile.proPlan : messages.profile.freePlan}</p>
          </button>
        </Card>

        <div className="grid gap-6">
          <Card>
            <h2 className="text-lg font-bold text-primary">{messages.profile.account}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField label={messages.profile.firstName} value={profile.firstName} readOnly />
              <TextField label={messages.profile.lastName} value={profile.lastName} readOnly />
              <TextField label={messages.profile.email} value={profile.email} readOnly className="md:col-span-2" />
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-primary">{messages.profile.business}</h2>
            <div className="mt-4 grid gap-4">
              <TextField label={messages.profile.businessName} value={profile.businessName} readOnly />
              <TextField label={messages.profile.address} value={profile.address} readOnly />
            </div>
          </Card>

          <div id="plans-section" ref={plansRef}>
            <Card>
              <div className="flex flex-col gap-2 border-b border-subtle pb-4">
                <h2 className="text-lg font-bold text-primary">{messages.profile.plans}</h2>
                <p className="text-sm leading-6 text-muted">{messages.profile.plansDescription}</p>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <PlanCard
                  title={messages.profile.freePlan}
                  price={messages.profile.freePlanPrice}
                  description={messages.profile.freePlanDescription}
                  features={messages.profile.freePlanFeatures}
                  isCurrent={!isProPlan}
                  onClick={() => handlePlanClick("free")}
                  currentPlanLabel={messages.profile.currentPlan}
                />
                <PlanCard
                  title={messages.profile.proPlan}
                  price={messages.profile.proPlanPrice}
                  description={messages.profile.proPlanDescription}
                  features={messages.profile.proPlanFeatures}
                  isCurrent={isProPlan}
                  isRecommended
                  onClick={() => handlePlanClick("pro")}
                  currentPlanLabel={messages.profile.currentPlan}
                  recommendedLabel={messages.profile.recommendedPlan}
                />
              </div>
            </Card>
          </div>

          <Card>
            <h2 className="text-lg font-bold text-primary">{messages.profile.preferences}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SelectField
                label={messages.profile.theme}
                value={theme}
                onChange={(event) => onThemeChange(event.target.value as ThemeId)}
                options={themeOptions.map((item) => ({ value: item, label: messages.themes[item] }))}
              />
              <SelectField
                label={messages.profile.language}
                value={locale}
                onChange={(event) => onLocaleChange(event.target.value as Locale)}
                options={[
                  { value: "es", label: "Español" },
                  { value: "en", label: "English" }
                ]}
              />
            </div>
            <div className="mt-5 flex flex-col gap-3 rounded-lg border border-subtle bg-input p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">{messages.profile.passwordHint}</p>
              <Button
                variant="secondary"
                icon={<FiLock />}
                isLoading={isRequestingPasswordReset}
                disabled={!profile.email}
                onClick={() => void handlePasswordReset()}
              >
                {messages.actions.changePassword}
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {pendingTier ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-primary/35 p-4">
          <Card className="w-full max-w-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-primary">
                  {pendingTier === "pro" ? messages.profile.subscribeTitle : messages.profile.unsubscribeTitle}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {pendingTier === "pro" ? messages.profile.subscribeDescription : messages.profile.unsubscribeDescription}
                </p>
              </div>
              <Button size="icon" variant="ghost" aria-label="Close modal" onClick={closeModal}>
                <FiX />
              </Button>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeModal}>
                {messages.actions.cancel}
              </Button>
              <Button onClick={confirmPlanChange}>
                {pendingTier === "pro" ? messages.profile.subscribeAction : messages.profile.unsubscribeAction}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function PlanCard({
  title,
  price,
  description,
  features,
  isCurrent,
  isRecommended = false,
  onClick,
  currentPlanLabel,
  recommendedLabel
}: {
  title: string;
  price: string;
  description: string;
  features: readonly string[];
  isCurrent: boolean;
  isRecommended?: boolean;
  onClick: () => void;
  currentPlanLabel: string;
  recommendedLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-5 text-left transition-all hover:-translate-y-1 hover:shadow-lg ${isCurrent ? "border-brand bg-brand-soft" : "border-subtle bg-input"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-primary">{title}</h3>
          <p className="mt-2 text-3xl font-bold text-primary">{price}</p>
          <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        </div>
        <div className="grid justify-items-end gap-2">
          {isCurrent ? <Badge tone="brand">{currentPlanLabel}</Badge> : null}
          {isRecommended && recommendedLabel ? <Badge tone="success">{recommendedLabel}</Badge> : null}
        </div>
      </div>

      <ul className="mt-5 grid gap-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-primary">
            <span className="mt-0.5 text-brand-strong" aria-hidden="true">
              {isRecommended ? <FiZap /> : <FiCheckCircle />}
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}
