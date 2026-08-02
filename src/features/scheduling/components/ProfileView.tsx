import { useEffect, useRef, useState } from "react";
import { FiArrowRight, FiCheckCircle, FiClock, FiLock, FiMapPin, FiX, FiZap } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { Modal } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/SelectField";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { TextField } from "@/components/ui/TextField";
import { SectionHeader } from "@/components/composed/SectionHeader";
import { Messages } from "@/features/scheduling/i18n/messages";
import { BusinessProfile, Locale, Profile, SubscriptionTier, ThemeId } from "@/features/scheduling/types";

type ProfileViewProps = {
  messages: Messages;
  profile: Profile;
  locale: Locale;
  theme: ThemeId;
  themeOptions: ThemeId[];
  onRequestPasswordReset: (email: string) => Promise<void>;
  onLocaleChange: (locale: Locale) => void;
  onSaveBusinessProfile: (profile: BusinessProfile) => Promise<boolean>;
  onThemeChange: (theme: ThemeId) => void;
  onBusinessImageUploadError: (message: string) => void;
  onSubscribeToPro: () => Promise<void>;
  onUnsubscribeFromPro: () => Promise<boolean>;
};

export function ProfileView({
  messages,
  profile,
  locale,
  theme,
  themeOptions,
  onRequestPasswordReset,
  onLocaleChange,
  onSaveBusinessProfile,
  onThemeChange,
  onBusinessImageUploadError,
  onSubscribeToPro,
  onUnsubscribeFromPro
}: ProfileViewProps) {
  const plansRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"account" | "business">("account");
  const [businessDraft, setBusinessDraft] = useState<BusinessProfile>(() => createBusinessDraft(profile));
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] = useState(false);
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [isSubmittingPlanChange, setIsSubmittingPlanChange] = useState(false);
  const isProPlan = profile.subscriptionTier === "pro";

  useEffect(() => {
    setBusinessDraft(createBusinessDraft(profile));
  }, [profile]);

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

  async function confirmPlanChange() {
    if (!pendingTier) {
      return;
    }

    setIsSubmittingPlanChange(true);

    if (pendingTier === "pro") {
      await onSubscribeToPro();
      setIsSubmittingPlanChange(false);
      closeModal();
      return;
    }

    const didCancel = await onUnsubscribeFromPro();
    setIsSubmittingPlanChange(false);

    if (didCancel) {
      closeModal();
    }
  }

  async function handlePasswordReset() {
    if (!profile.email) {
      return;
    }

    setIsRequestingPasswordReset(true);
    await onRequestPasswordReset(profile.email);
    setIsRequestingPasswordReset(false);
  }

  async function handleBusinessSave() {
    setIsSavingBusiness(true);
    await onSaveBusinessProfile(businessDraft);
    setIsSavingBusiness(false);
  }

  return (
    <div className="grid gap-6">
      <SectionHeader
        eyebrow={messages.profile.eyebrow}
        title={messages.profile.title}
        description={messages.profile.description}
      />

      <div className="flex w-fit rounded-xl border border-subtle bg-surface p-1">
        <button
          type="button"
          onClick={() => setActiveTab("account")}
          className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-bold transition-colors ${activeTab === "account" ? "bg-brand text-on-brand" : "text-muted hover:bg-surface-strong hover:text-primary"}`}
        >
          {messages.profile.accountTab}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("business")}
          className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-bold transition-colors ${activeTab === "business" ? "bg-brand text-on-brand" : "text-muted hover:bg-surface-strong hover:text-primary"}`}
        >
          {messages.profile.businessTab}
        </button>
      </div>

      <section className={`grid gap-6 ${activeTab === "account" ? "xl:grid-cols-[22rem_1fr]" : ""}`}>
        {activeTab === "account" ? (
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
        ) : null}

        {activeTab === "account" ? (
          <div className="grid gap-6">
            <Card>
              <h2 className="text-lg font-bold text-primary">{messages.profile.account}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextField label={messages.profile.firstName} value={profile.firstName} readOnly />
                <TextField label={messages.profile.lastName} value={profile.lastName} readOnly />
                <TextField label={messages.profile.email} value={profile.email} readOnly className="md:col-span-2" />
              </div>
            </Card>

            <div id="planes" ref={plansRef}>
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
        ) : (
          <BusinessProfilePanel
            draft={businessDraft}
            isSaving={isSavingBusiness}
            messages={messages}
            onChange={setBusinessDraft}
            onImageUploadError={onBusinessImageUploadError}
            onSave={() => void handleBusinessSave()}
          />
        )}
      </section>

      <Modal isOpen={Boolean(pendingTier)}>
        {pendingTier ? (
          <>
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

            {pendingTier === "pro" ? (
              <div className="mt-6 rounded-2xl border border-brand bg-brand-soft p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand text-lg text-on-brand">
                    <FiZap aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brand-strong">{messages.profile.subscribeBenefitsEyebrow}</p>
                    <h3 className="mt-1 text-lg font-bold text-primary">{messages.profile.proPlan}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{messages.profile.subscribeCheckoutHint}</p>
                  </div>
                </div>

                <ul className="mt-5 grid gap-3">
                  {messages.profile.proPlanFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-primary">
                      <FiCheckCircle className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeModal}>
                {messages.actions.cancel}
              </Button>
              <Button
                icon={pendingTier === "pro" ? <FiArrowRight /> : undefined}
                isLoading={isSubmittingPlanChange}
                onClick={() => void confirmPlanChange()}
              >
                {pendingTier === "pro" ? messages.profile.subscribeAction : messages.profile.unsubscribeAction}
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}

function BusinessProfilePanel({
  draft,
  isSaving,
  messages,
  onChange,
  onImageUploadError,
  onSave
}: {
  draft: BusinessProfile;
  isSaving: boolean;
  messages: Messages;
  onChange: (draft: BusinessProfile) => void;
  onImageUploadError: (message: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="grid gap-6">
      <Card className="bg-brand-soft">
        <h2 className="text-lg font-bold text-primary">{messages.profile.business}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{messages.profile.businessPublicHint}</p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex flex-col gap-2 border-b border-subtle pb-4">
            <h2 className="text-lg font-bold text-primary">{messages.profile.business}</h2>
            <p className="text-sm leading-6 text-muted">{messages.profile.publicDescriptionHint}</p>
          </div>

          <div className="mt-5 grid gap-4">
            <TextField
              label={messages.profile.businessName}
              value={draft.name}
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
            />
            <TextField
              label={messages.profile.address}
              value={draft.address}
              onChange={(event) => onChange({ ...draft, address: event.target.value })}
            />
            <TextAreaField
              label={messages.profile.publicDescription}
              placeholder={messages.profile.publicDescriptionHint}
              value={draft.publicDescription}
              onChange={(event) => onChange({ ...draft, publicDescription: event.target.value })}
            />
            <TextAreaField
              label={messages.profile.publicOpeningHours}
              placeholder={messages.profile.publicOpeningHoursHint}
              value={draft.publicOpeningHours}
              onChange={(event) => onChange({ ...draft, publicOpeningHours: event.target.value })}
            />
            <ImageUploadField
              label={messages.profile.publicLogo}
              value={draft.publicLogoUrl}
              onChange={(value) => onChange({ ...draft, publicLogoUrl: value })}
              onError={onImageUploadError}
              chooseLabel={messages.actions.uploadImage}
              replaceLabel={messages.actions.replaceImage}
              removeLabel={messages.actions.removeImage}
              requirementsLabel={messages.profile.publicLogo}
              helperText={messages.profile.businessPublicHint}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button isLoading={isSaving} onClick={onSave}>
              {messages.actions.save}
            </Button>
          </div>
        </Card>

        <Card className="h-fit overflow-hidden p-0">
          <div className="bg-brand-soft p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-strong">{messages.profile.businessPreview}</p>
            <div className="mt-4 flex items-center gap-4">
              <div
                className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-subtle bg-surface bg-cover bg-center text-lg font-bold text-primary"
                style={{ backgroundImage: draft.publicLogoUrl ? `url(${draft.publicLogoUrl})` : undefined }}
              >
                {draft.publicLogoUrl ? null : getBusinessInitials(draft.name)}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-2xl font-bold text-primary">{draft.name || messages.profile.businessName}</h3>
                <p className="mt-1 text-sm text-muted">{messages.businessType}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5">
            <p className="text-sm leading-6 text-muted">
              {draft.publicDescription || messages.profile.publicDescriptionHint}
            </p>
            <div className="grid gap-3 rounded-xl border border-subtle bg-input p-4 text-sm">
              <div className="flex items-start gap-3">
                <FiMapPin className="mt-0.5 shrink-0 text-brand-strong" aria-hidden="true" />
                <span className="text-muted">{draft.address || messages.profile.address}</span>
              </div>
              <div className="flex items-start gap-3">
                <FiClock className="mt-0.5 shrink-0 text-brand-strong" aria-hidden="true" />
                <span className="whitespace-pre-line text-muted">{draft.publicOpeningHours || messages.profile.publicOpeningHoursHint}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
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
      className={`w-full rounded-2xl border p-5 text-left transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer ${isCurrent ? "border-brand bg-brand-soft" : "border-subtle bg-input"}`}
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

function createBusinessDraft(profile: Profile): BusinessProfile {
  return {
    name: profile.businessName,
    address: profile.address,
    publicDescription: profile.publicDescription,
    publicLogoUrl: profile.publicLogoUrl,
    publicOpeningHours: profile.publicOpeningHours
  };
}

function getBusinessInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "MT";
}
