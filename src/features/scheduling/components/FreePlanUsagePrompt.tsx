"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiZap } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Messages } from "@/features/scheduling/i18n/messages";
import { freePlanLimits } from "@/features/scheduling/plan-limits";
import { consumeProUpgradePrompt } from "@/lib/pro-upgrade-session";

type FreePlanUsagePromptProps = {
  messages: Messages;
  userId: string;
  usage: number;
  tier: string;
};

export function FreePlanUsagePrompt({ messages, userId, usage, tier }: FreePlanUsagePromptProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (consumeProUpgradePrompt(window.sessionStorage, userId, usage, tier)) {
        setIsOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [userId, usage, tier]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen && tier === "free"}>
      <div className="grid gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-2xl text-brand-strong" aria-hidden="true">
          <FiZap />
        </span>
        <h2 className="text-xl font-bold text-primary">{messages.upgrade.usageTitle}</h2>
        <p className="font-semibold text-primary">
          {messages.upgrade.usageDescription.replace("{usage}", String(usage)).replace("{limit}", String(freePlanLimits.monthlyAppointments))}
        </p>
        <p className="text-sm leading-6 text-muted">{messages.upgrade.usageBenefits}</p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" autoFocus onClick={() => setIsOpen(false)}>{messages.upgrade.later}</Button>
          <Link
            href="/perfil?plan=pro"
            onClick={() => setIsOpen(false)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <FiZap aria-hidden="true" />
            {messages.upgrade.viewPlan}
          </Link>
        </div>
      </div>
    </Modal>
  );
}
