"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/features/auth/components/AuthProvider";

type EmailConfirmationResendButtonProps = {
  email: string;
  initialCooldown?: number;
};

export function EmailConfirmationResendButton({ email, initialCooldown = 0 }: EmailConfirmationResendButtonProps) {
  const { resendEmailConfirmation } = useAuth();
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(initialCooldown);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [resendCooldown]);

  async function handleResendConfirmation() {
    if (!email || resendCooldown > 0 || isResendingConfirmation) {
      return;
    }

    setIsResendingConfirmation(true);
    setResendMessage("");
    const result = await resendEmailConfirmation(email);
    setIsResendingConfirmation(false);

    if (result.status === "error") {
      setResendMessage(result.message);
      return;
    }

    setResendMessage(`Reenviamos el mail de confirmacion a ${result.email}.`);
    setResendCooldown(30);
  }

  const isDisabled = resendCooldown > 0 || isResendingConfirmation;

  return (
    <div className="grid gap-2">
      <button
        type="button"
        className={isDisabled
          ? "w-full cursor-not-allowed text-center text-sm font-bold text-muted underline underline-offset-4"
          : "w-full cursor-pointer text-center text-sm font-bold !text-brand-strong underline decoration-brand-strong/45 underline-offset-4 transition-colors hover:!text-brand hover:decoration-brand/45"}
        disabled={isDisabled}
        onClick={() => void handleResendConfirmation()}
      >
        {isResendingConfirmation
          ? "Reenviando..."
          : resendCooldown > 0
            ? `Reenviar mail de confirmacion en ${resendCooldown}s`
            : "Reenviar mail de confirmacion"}
      </button>
      {resendMessage ? (
        <p className="text-sm font-semibold text-muted-strong">{resendMessage}</p>
      ) : null}
    </div>
  );
}
