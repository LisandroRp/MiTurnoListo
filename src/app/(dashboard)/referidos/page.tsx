"use client";

import { FiGift } from "react-icons/fi";

import { SectionHeader } from "@/components/composed/SectionHeader";
import { ReferralProgramPanel } from "@/features/scheduling/components/ReferralProgramPanel";
import { useScheduling } from "@/features/scheduling/components/SchedulingProvider";

export default function ReferralsSectionPage() {
  const {
    activateReferralProgram,
    messages,
    profile
  } = useScheduling();

  return (
    <div className="grid gap-6">
      <SectionHeader
        icon={<FiGift />}
        eyebrow={messages.profile.referralsBadge}
        title={messages.profile.referralsTitle}
        description={messages.profile.referralsDescription}
      />
      <ReferralProgramPanel
        messages={messages}
        profile={profile}
        onActivate={activateReferralProgram}
      />
    </div>
  );
}
