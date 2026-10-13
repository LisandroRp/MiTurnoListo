"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiBriefcase, FiCheckCircle, FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { TextField } from "@/components/ui/TextField";
import { EmailConfirmationResendButton } from "@/features/auth/components/EmailConfirmationResendButton";
import { useAuth } from "@/features/auth/components/AuthProvider";

type SignUpFormProps = {
  nextPath: string;
};

export function SignUpForm({ nextPath }: SignUpFormProps) {
  const { signUp } = useAuth();
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setConfirmationEmail("");

    if (!businessName.trim()) {
      setErrorMessage("Ingresá el nombre de tu negocio.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("La contraseña tiene que tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);
    const result = await signUp(email, password, rememberSession, businessName);
    setIsSubmitting(false);

    if (result.status === "error") {
      setErrorMessage(result.message);
      return;
    }

    if (result.status === "authenticated") {
      router.replace(nextPath);
      return;
    }

    setConfirmationEmail(result.email);
    setSuccessMessage(`Tu cuenta se creó correctamente. Te enviamos un mail a ${result.email} para confirmarla antes de iniciar sesión.`);
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <TextField
        label="Nombre del negocio"
        name="signup-business-name"
        type="text"
        value={businessName}
        autoComplete="organization"
        maxLength={80}
        prefix={<FiBriefcase />}
        required
        onChange={(event) => setBusinessName(event.target.value)}
      />
      <TextField
        label="Email"
        name="signup-email"
        type="email"
        value={email}
        autoComplete="email"
        prefix={<FiMail />}
        required
        onChange={(event) => setEmail(event.target.value)}
      />
      <TextField
        label="Contraseña"
        name="signup-password"
        type={showPassword ? "text" : "password"}
        value={password}
        autoComplete="new-password"
        helperText="Usá al menos 6 caracteres."
        prefix={<FiLock />}
        required
        onChange={(event) => setPassword(event.target.value)}
        suffix={
          <button
            type="button"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-surface-strong hover:text-primary"
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        }
      />
      <TextField
        label="Confirmar contraseña"
        name="signup-confirm-password"
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        autoComplete="new-password"
        prefix={<FiLock />}
        required
        onChange={(event) => setConfirmPassword(event.target.value)}
        suffix={
          <button
            type="button"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-md text-muted transition-colors hover:bg-surface-strong hover:text-primary"
            aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            onClick={() => setShowConfirmPassword((current) => !current)}
          >
            {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        }
      />
      <CheckboxField
        label="Mantener sesión"
        helperText="Si entrás directamente después de registrarte, recordamos este dispositivo."
        checked={rememberSession}
        onChange={(event) => setRememberSession(event.target.checked)}
      />

      {errorMessage ? (
        <div className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="grid gap-2 rounded-lg border border-success bg-success-soft p-3 text-sm font-semibold text-success">
          <span className="flex items-start gap-2">
            <FiCheckCircle className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{successMessage}</span>
          </span>
          {confirmationEmail ? (
            <EmailConfirmationResendButton email={confirmationEmail} initialCooldown={30} />
          ) : null}
        </div>
      ) : null}

      <Button type="submit" size="lg" isLoading={isSubmitting} disabled={!businessName.trim() || !email || !password || !confirmPassword}>
        Crear cuenta
      </Button>

      {successMessage ? (
        <Link href={`/login?mode=login${nextPath !== "/inicio" ? `&next=${encodeURIComponent(nextPath)}` : ""}`} className="text-sm font-semibold text-brand-strong hover:text-brand">
          Ir a iniciar sesión
        </Link>
      ) : null}
    </form>
  );
}
