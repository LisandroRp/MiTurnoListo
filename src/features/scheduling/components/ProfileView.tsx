import { ChangeEvent, RefObject, useEffect, useRef, useState } from "react";
import { FiArrowRight, FiCheckCircle, FiClock, FiLock, FiMapPin, FiUpload, FiX, FiZap } from "react-icons/fi";

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
import { uploadBusinessImageAsset } from "@/lib/storage/business-assets";

const avatarAcceptedTypes = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
const avatarAcceptedExtensions = [".heic", ".heif"];

type ProfileViewProps = {
  messages: Messages;
  profile: Profile;
  businessId: string | null;
  locale: Locale;
  theme: ThemeId;
  themeOptions: ThemeId[];
  onRequestPasswordReset: (email: string) => Promise<void>;
  onLocaleChange: (locale: Locale) => void;
  onSaveBusinessProfile: (profile: BusinessProfile) => Promise<boolean>;
  onSaveProfileAvatar: (avatarUrl: string) => Promise<boolean>;
  onThemeChange: (theme: ThemeId) => void;
  onBusinessImageUploadError: (message: string) => void;
  onSubscribeToPro: () => Promise<void>;
  onUnsubscribeFromPro: () => Promise<boolean>;
};

export function ProfileView({
  messages,
  profile,
  businessId,
  locale,
  theme,
  themeOptions,
  onRequestPasswordReset,
  onLocaleChange,
  onSaveBusinessProfile,
  onSaveProfileAvatar,
  onThemeChange,
  onBusinessImageUploadError,
  onSubscribeToPro,
  onUnsubscribeFromPro
}: ProfileViewProps) {
  const plansRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<"account" | "business">("account");
  const [businessDraft, setBusinessDraft] = useState<BusinessProfile>(() => createBusinessDraft(profile));
  const [avatarDraftFile, setAvatarDraftFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [pendingBusinessLogoFile, setPendingBusinessLogoFile] = useState<File | null>(null);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [isSubmittingPlanChange, setIsSubmittingPlanChange] = useState(false);
  const isProPlan = profile.subscriptionTier === "pro";

  useEffect(() => {
    setBusinessDraft(createBusinessDraft(profile));
    setPendingBusinessLogoFile(null);
  }, [profile]);

  useEffect(() => {
    if (!avatarDraftFile) {
      setAvatarPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(avatarDraftFile);
    setAvatarPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [avatarDraftFile]);

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

    try {
      if (pendingBusinessLogoFile && !businessId) {
        throw new Error("No pudimos identificar el negocio para subir el logo.");
      }

      const profileToSave = pendingBusinessLogoFile && businessId
        ? {
            ...businessDraft,
            publicLogoUrl: await uploadBusinessImageAsset({
              businessId,
              file: pendingBusinessLogoFile,
              path: `${businessId}/logo.webp`
            })
          }
        : businessDraft;
      const didSave = await onSaveBusinessProfile(profileToSave);

      if (didSave) {
        setPendingBusinessLogoFile(null);
      }
    } catch (error) {
      onBusinessImageUploadError(error instanceof Error ? error.message : "No pudimos subir el logo del negocio.");
    } finally {
      setIsSavingBusiness(false);
    }
  }

  function openAvatarPicker() {
    avatarInputRef.current?.click();
  }

  function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!isAcceptedAvatarFile(file)) {
      onBusinessImageUploadError("Formatos permitidos: PNG, JPG, WEBP, HEIC o HEIF.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onBusinessImageUploadError("La imagen debe pesar menos de 5 MB.");
      event.target.value = "";
      return;
    }

    setAvatarDraftFile(file);
    event.target.value = "";
  }

  async function confirmAvatarUpload() {
    if (!avatarDraftFile || !businessId) {
      return;
    }

    setIsSavingAvatar(true);

    try {
      const avatarUrl = await uploadBusinessImageAsset({
        businessId,
        file: avatarDraftFile,
        path: `${businessId}/profile/avatar.webp`
      });
      const didSave = await onSaveProfileAvatar(avatarUrl);

      if (didSave) {
        setAvatarDraftFile(null);
      }
    } catch (error) {
      onBusinessImageUploadError(error instanceof Error ? error.message : "No pudimos subir la foto de perfil.");
    } finally {
      setIsSavingAvatar(false);
    }
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
            <ProfileAvatarUploader
              inputRef={avatarInputRef}
              isSaving={isSavingAvatar}
              messages={messages}
              previewUrl={avatarPreviewUrl}
              profile={profile}
              onCancel={() => setAvatarDraftFile(null)}
              onConfirm={() => void confirmAvatarUpload()}
              onFileChange={handleAvatarFileChange}
              onOpenPicker={openAvatarPicker}
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
            onSelectedLogoFileChange={setPendingBusinessLogoFile}
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

function ProfileAvatarUploader({
  inputRef,
  isSaving,
  messages,
  previewUrl,
  profile,
  onCancel,
  onConfirm,
  onFileChange,
  onOpenPicker
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  isSaving: boolean;
  messages: Messages;
  previewUrl: string;
  profile: Profile;
  onCancel: () => void;
  onConfirm: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenPicker: () => void;
}) {
  const avatarUrl = previewUrl || profile.avatarUrl;
  const hasPendingAvatar = previewUrl.trim().length > 0;

  return (
    <div className="grid justify-items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
        className="sr-only"
        onChange={onFileChange}
      />
      <button
        type="button"
        aria-label={messages.profile.avatarUploadLabel}
        className="group relative h-28 w-28 cursor-pointer overflow-hidden rounded-full border border-subtle bg-surface-strong transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-focus"
        onClick={onOpenPicker}
      >
        {avatarUrl ? (
          <span
            className="block h-full w-full bg-contain bg-center bg-no-repeat transition duration-200 group-hover:scale-105 group-hover:blur-[2px]"
            style={{ backgroundImage: `url(${avatarUrl})` }}
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-2xl font-bold text-primary transition duration-200 group-hover:blur-[2px]">
            {getProfileInitials(profile)}
          </span>
        )}
        <span className="absolute inset-0 grid place-items-center bg-primary/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-xl text-brand-strong shadow-sm">
            <FiUpload aria-hidden="true" />
          </span>
        </span>
      </button>
      <p className="text-center text-xs leading-5 text-muted">{messages.profile.avatarUploadHint}</p>
      {hasPendingAvatar ? (
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={isSaving}
            className="border-brand bg-surface text-brand-strong hover:bg-brand-soft"
            onClick={onCancel}
          >
            {messages.actions.cancel}
          </Button>
          <Button size="sm" isLoading={isSaving} onClick={onConfirm}>
            {messages.profile.avatarConfirmAction}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function BusinessProfilePanel({
  draft,
  isSaving,
  messages,
  onChange,
  onImageUploadError,
  onSelectedLogoFileChange,
  onSave
}: {
  draft: BusinessProfile;
  isSaving: boolean;
  messages: Messages;
  onChange: (draft: BusinessProfile) => void;
  onImageUploadError: (message: string) => void;
  onSelectedLogoFileChange: (file: File | null) => void;
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
              required
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
              onSelectedFileChange={onSelectedLogoFileChange}
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
                className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-subtle bg-surface bg-contain bg-center bg-no-repeat text-lg font-bold text-primary"
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

function getProfileInitials(profile: Profile) {
  const initials = [profile.firstName, profile.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || profile.email[0]?.toUpperCase() || "ML";
}

function isAcceptedAvatarFile(file: File) {
  const normalizedName = file.name.toLowerCase();

  return (
    avatarAcceptedTypes.includes(file.type) ||
    avatarAcceptedExtensions.some((extension) => normalizedName.endsWith(extension))
  );
}

function getBusinessInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "MT";
}
