import { useState } from "react";
import { FiZap } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Profile } from "@/features/scheduling/types";

type ProfileReferralRewardCalloutProps = {
  hasError: boolean;
  isLoading: boolean;
  messages: Messages;
  onActivate: () => Promise<boolean>;
  profile: Profile;
};

export function ProfileReferralRewardCallout({
  hasError,
  isLoading,
  messages,
  onActivate,
  profile
}: ProfileReferralRewardCalloutProps) {
  const [isActivating, setIsActivating] = useState(false);

  async function handleActivate() {
    setIsActivating(true);
    try {
      await onActivate();
    } finally {
      setIsActivating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mt-3 rounded-lg border border-subtle bg-input p-4" aria-hidden="true">
        <span className="block h-4 w-32 animate-pulse rounded-full bg-surface-strong" />
        <span className="mt-3 block h-4 w-full animate-pulse rounded-full bg-surface-strong" />
        <span className="mt-2 block h-4 w-3/4 animate-pulse rounded-full bg-surface-strong" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="mt-3 rounded-lg border border-subtle bg-input p-4" role="status">
        <p className="text-sm font-bold text-primary">{messages.profile.referralRewardErrorTitle}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{messages.profile.referralRewardErrorDescription}</p>
      </div>
    );
  }

  if (profile.subscriptionAccessSource === "referral") {
    return (
      <div className="mt-3 rounded-lg border border-brand bg-brand-soft p-4">
        <p className="text-sm font-bold text-brand-strong">{messages.profile.referralProActiveTitle}</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          {messages.profile.referralProActivePrefix}{" "}
          <span className="font-bold text-primary">
            {profile.referralSummary.activeDaysRemaining} {messages.profile.superAdminReferralDays}
          </span>{" "}
          {messages.profile.referralProActiveSuffix}
        </p>
      </div>
    );
  }

  if (profile.referralSummary.availableRewardCount < 1) {
    return (
      <div className="mt-3 rounded-lg border border-subtle bg-input p-4" role="status">
        <p className="text-sm font-bold text-primary">{messages.profile.referralRewardEmptyTitle}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{messages.profile.referralRewardEmptyDescription}</p>
      </div>
    );
  }

  if (profile.subscriptionTier !== "free") {
    return (
      <div className="mt-3 rounded-lg border border-brand bg-brand-soft p-4" role="status">
        <p className="text-sm font-bold text-brand-strong">{messages.profile.referralRewardSavedTitle}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{messages.profile.referralRewardSavedDescription}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-brand bg-brand-soft p-4">
      <p className="text-sm font-bold text-brand-strong">{messages.profile.referralRewardAvailableTitle}</p>
      <p className="mt-1 text-sm leading-6 text-muted">
        {profile.referralSummary.availableRewardCount === 1
          ? messages.profile.referralRewardAvailableSingular
          : messages.profile.referralRewardAvailablePlural.replace("{count}", String(profile.referralSummary.availableRewardCount))}
      </p>
      <Button
        className="mt-4 w-full"
        icon={<FiZap />}
        isLoading={isActivating}
        onClick={() => void handleActivate()}
      >
        {messages.profile.referralRewardActivateAction}
      </Button>
    </div>
  );
}
