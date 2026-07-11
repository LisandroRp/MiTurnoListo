"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { FiCheckCircle, FiEye, FiEyeOff, FiLock } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/components/AuthProvider";

type ResetPasswordFormProps = {
  forgotPasswordHref: string;
  loginHref: string;
};

export function ResetPasswordForm({ forgotPasswordHref, loginHref }: ResetPasswordFormProps) {
  const { status, updatePassword, userEmail } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const isRecoveryReady = status === "recovery";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (password.length < 6) {
      setErrorMessage("La password tiene que tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Las passwords no coinciden.");
      return;
    }

    setIsSubmitting(true);
    const result = await updatePassword(password);
    setIsSubmitting(false);

    if (result.status === "error") {
      setErrorMessage(result.message);
      return;
    }

    setSuccessMessage("Actualizamos tu password. Ya puedes iniciar sesion con la nueva clave.");
    setPassword("");
    setConfirmPassword("");
  }

  if (!isRecoveryReady && !successMessage) {
    return (
      <div className="grid gap-4">
        <div className="rounded-lg border border-warning bg-warning-soft p-3 text-sm font-semibold text-warning">
          Este enlace de recuperacion ya vencio o no es valido. Pide uno nuevo para continuar.
        </div>
        <Link href={forgotPasswordHref} className="text-sm font-semibold text-brand-strong hover:text-brand">
          Pedir otro reset
        </Link>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      {userEmail ? (
        <div className="rounded-lg border border-subtle bg-input p-3 text-sm text-muted">
          Vas a actualizar la password de <span className="font-semibold text-primary">{userEmail}</span>.
        </div>
      ) : null}

      <TextField
        label="Nueva password"
        name="recovery-password"
        type={showPassword ? "text" : "password"}
        value={password}
        autoComplete="new-password"
        helperText="Usa al menos 6 caracteres."
        prefix={<FiLock />}
        onChange={(event) => setPassword(event.target.value)}
        suffix={
          <button
            type="button"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-surface-strong hover:text-primary"
            aria-label={showPassword ? "Ocultar password" : "Mostrar password"}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        }
      />
      <TextField
        label="Confirm password"
        name="recovery-confirm-password"
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        autoComplete="new-password"
        prefix={<FiLock />}
        onChange={(event) => setConfirmPassword(event.target.value)}
        suffix={
          <button
            type="button"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-surface-strong hover:text-primary"
            aria-label={showConfirmPassword ? "Ocultar password" : "Mostrar password"}
            onClick={() => setShowConfirmPassword((current) => !current)}
          >
            {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        }
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

      <Button
        type="submit"
        size="lg"
        isLoading={isSubmitting}
        disabled={!password || !confirmPassword || !isRecoveryReady}
      >
        Guardar nueva password
      </Button>

      <Link href={loginHref} className="text-sm font-semibold text-brand-strong hover:text-brand">
        Volver al login
      </Link>
    </form>
  );
}
