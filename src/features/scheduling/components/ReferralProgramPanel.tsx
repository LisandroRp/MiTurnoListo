import { useState } from "react";
import { FiCopy, FiGift, FiShare2 } from "react-icons/fi";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Messages } from "@/features/scheduling/i18n/messages";
import { Profile } from "@/features/scheduling/types";

type ReferralProgramPanelProps = {
  messages: Messages;
  profile: Profile;
  onActivate: () => Promise<boolean>;
};

export function ReferralProgramPanel({
  messages,
  profile,
  onActivate
}: ReferralProgramPanelProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [copiedReferralLink, setCopiedReferralLink] = useState(false);
  const summary = profile.referralSummary;
  const isMaxed = summary.availableMonths >= 3;

  async function handleActivate() {
    setIsActivating(true);
    await onActivate();
    setIsActivating(false);
  }

  async function copyReferralLink() {
    if (!summary.referralLink) {
      return;
    }

    await navigator.clipboard.writeText(summary.referralLink);
    setCopiedReferralLink(true);
    window.setTimeout(() => setCopiedReferralLink(false), 1600);
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 border-b border-subtle pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-primary">{messages.profile.referralsTitle}</h2>
            <Badge tone="brand">{messages.profile.referralsBadge}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">{messages.profile.referralsDescription}</p>
        </div>
        {!summary.isProgramActive ? (
          <Button icon={<FiGift />} isLoading={isActivating} onClick={() => void handleActivate()}>
            {messages.profile.referralsActivateAction}
          </Button>
        ) : null}
      </div>

      {summary.isProgramActive ? (
        <>
          <div className="mt-5 grid gap-3 rounded-lg border border-subtle bg-input p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{messages.profile.referralsYourCode}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-all text-2xl font-bold text-primary">{summary.referralCode}</p>
                <p className="mt-1 break-all text-sm text-muted">{summary.referralLink}</p>
              </div>
              <Button variant="secondary" icon={<FiCopy />} onClick={() => void copyReferralLink()}>
                {copiedReferralLink ? messages.profile.referralsCopiedAction : messages.profile.referralsCopyAction}
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <ReferralMetric label={messages.profile.referralsRegisteredMetric} value={summary.registeredCount} />
            <ReferralMetric label={messages.profile.referralsPremiumMetric} value={summary.premiumReferralCount} />
            <ReferralMetric
              label={messages.profile.referralsAvailableMetric}
              value={summary.availableMonths}
              suffix={isMaxed ? "MAX" : undefined}
              isBrand={isMaxed}
            />
            <ReferralMetric label={messages.profile.referralsUsedMetric} value={summary.usedMonths} />
          </div>

          <div className="mt-5 flex items-start gap-3 rounded-lg border border-subtle bg-surface-strong p-4">
            <FiShare2 className="mt-0.5 shrink-0 text-brand-strong" aria-hidden="true" />
            <p className="text-sm leading-6 text-muted">{messages.profile.referralsRules}</p>
          </div>
        </>
      ) : (
        <div className="mt-5 grid gap-3 rounded-lg border border-subtle bg-input p-4 text-sm leading-6 text-muted">
          <p>{messages.profile.referralsInactiveHint}</p>
          <p>{messages.profile.referralsRules}</p>
        </div>
      )}
    </Card>
  );
}

function ReferralMetric({
  isBrand = false,
  label,
  suffix,
  value
}: {
  isBrand?: boolean;
  label: string;
  suffix?: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-subtle bg-input p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={`mt-2 flex items-baseline gap-2 text-3xl font-bold ${isBrand ? "text-brand-strong" : "text-primary"}`}>
        {value}
        {suffix ? <span className="text-xs font-bold text-brand-strong">{suffix}</span> : null}
      </p>
    </div>
  );
}
