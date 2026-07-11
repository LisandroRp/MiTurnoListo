"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiCheckCircle, FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/components/AuthProvider";

type SignUpFormProps = {
  nextPath: string;
};

export function SignUpForm({ nextPath }: SignUpFormProps) {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
    const result = await signUp(email, password, rememberSession);
    setIsSubmitting(false);

    if (result.status === "error") {
      setErrorMessage(result.message);
      return;
    }

    if (result.status === "authenticated") {
      router.replace(nextPath);
      return;
    }

    setSuccessMessage(`Te enviamos un mail a ${result.email}. Confirma la cuenta y despues inicia sesion.`);
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <TextField
        label="Email"
        name="signup-email"
        type="email"
        value={email}
        autoComplete="email"
        prefix={<FiMail />}
        onChange={(event) => setEmail(event.target.value)}
      />
      <TextField
        label="Password"
        name="signup-password"
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
        name="signup-confirm-password"
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
      <CheckboxField
        label="Mantener sesion"
        helperText="Si el alta entra directo con sesion, recordamos este dispositivo."
        checked={rememberSession}
        onChange={(event) => setRememberSession(event.target.checked)}
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

      <Button type="submit" size="lg" isLoading={isSubmitting} disabled={!email || !password || !confirmPassword}>
        Crear cuenta
      </Button>

      {successMessage ? (
        <Link href={`/login?mode=login${nextPath !== "/inicio" ? `&next=${encodeURIComponent(nextPath)}` : ""}`} className="text-sm font-semibold text-brand-strong hover:text-brand">
          Ir al login
        </Link>
      ) : null}
    </form>
  );
}
