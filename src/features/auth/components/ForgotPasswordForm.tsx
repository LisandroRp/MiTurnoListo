"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { FiCheckCircle, FiMail } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/components/AuthProvider";

type ForgotPasswordFormProps = {
  defaultEmail?: string;
  loginHref: string;
};

export function ForgotPasswordForm({ defaultEmail = "", loginHref }: ForgotPasswordFormProps) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(defaultEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    const result = await requestPasswordReset(email);

    setIsSubmitting(false);

    if (result.status === "error") {
      setErrorMessage(result.message);
      return;
    }

    setSuccessMessage(`Te enviamos un link de recuperacion a ${result.email}. Revisa tu casilla y abre el mail desde ese dispositivo.`);
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <TextField
        label="Email"
        name="forgot-password-email"
        type="email"
        value={email}
        autoComplete="email"
        prefix={<FiMail />}
        onChange={(event) => setEmail(event.target.value)}
      />

      {errorMessage ? (
        <div className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-success bg-success-soft p-3 text-sm font-semibold text-success">
          <span className="flex items-start gap-2">
            <FiCheckCircle className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{successMessage}</span>
          </span>
        </div>
      ) : null}

      <Button type="submit" size="lg" isLoading={isSubmitting} disabled={!email}>
        Enviar reset password
      </Button>

      <Link href={loginHref} className="text-sm font-semibold text-brand-strong hover:text-brand">
        Volver al login
      </Link>
    </form>
  );
}
