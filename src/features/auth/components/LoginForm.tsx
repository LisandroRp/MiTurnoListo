"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/components/AuthProvider";

type LoginFormProps = {
  nextPath: string;
  defaultEmail?: string;
  forgotPasswordHref: string;
};

export function LoginForm({ nextPath, defaultEmail = "", forgotPasswordHref }: LoginFormProps) {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const isAuthenticated = await login(email, password, rememberSession);
    setIsSubmitting(false);

    if (!isAuthenticated) {
      setErrorMessage("Credenciales incorrectas. Revisa tu usuario de Supabase e intenta otra vez.");
      return;
    }

    router.replace(nextPath);
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <TextField
        label="Email"
        name="email"
        type="email"
        value={email}
        autoComplete="email"
        prefix={<FiMail />}
        onChange={(event) => setEmail(event.target.value)}
      />
      <TextField
        label="Password"
        name="password"
        type={showPassword ? "text" : "password"}
        value={password}
        autoComplete="current-password"
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
      <CheckboxField
        label="Mantener sesion"
        helperText="Si lo desactivas, la sesion se mantiene solo en esta pestaña."
        checked={rememberSession}
        onChange={(event) => setRememberSession(event.target.checked)}
      />
      <div className="flex justify-end">
        <Link
          href={forgotPasswordHref}
          className="text-sm font-semibold text-brand-strong hover:text-brand"
        >
          Olvide mi password
        </Link>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger">
          {errorMessage}
        </div>
      ) : null}

      <Button type="submit" size="lg" isLoading={isSubmitting} disabled={!email || !password}>
        Entrar al panel
      </Button>
    </form>
  );
}
