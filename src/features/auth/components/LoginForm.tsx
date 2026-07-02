"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { FiArrowLeft, FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";

import { BrandMark } from "@/components/composed/BrandMark";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/features/auth/components/AuthProvider";

const defaultEmail = "lisandrorp1997@gmail.com";

function getSafeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/inicio";
  }

  return nextPath;
}

export function LoginForm() {
  const { login, status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(nextPath);
    }
  }, [nextPath, router, status]);

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
    <main className="grid min-h-screen bg-page px-4 py-8 text-primary lg:grid-cols-[1fr_0.9fr] lg:p-0">
      <section className="hidden bg-brand-soft p-10 lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-brand-strong">
          <FiArrowLeft aria-hidden="true" />
          Volver
        </Link>
        <div className="max-w-xl">
          <BrandMark variant="full" size="xl" priority />
          <Badge tone="brand" className="mt-4">Supabase Auth</Badge>
          <h1 className="mt-5 text-5xl font-bold leading-tight text-primary">
            Entra y deja que la agenda trabaje por vos.
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted">
            Ahora el acceso usa tu usuario real y el panel ya apunta a la base de datos que cargaste
            en Supabase.
          </p>
        </div>
        <div className="grid gap-3 text-sm text-muted">
          <p className="font-semibold text-primary">Usuario sugerido</p>
          <p>Email: {defaultEmail}</p>
          <p>Password: la que creaste en Supabase Auth</p>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-md items-center lg:max-w-none lg:justify-center">
        <div className="w-full lg:max-w-md">
          <Link href="/" className="mb-6 flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-muted hover:text-primary lg:hidden">
            <FiArrowLeft aria-hidden="true" />
            Volver
          </Link>
          <Card className="bg-sidebar p-6 sm:p-8">
            <div>
              <Link href="/" className="w-fit">
                <BrandMark variant="compact" size="lg" priority />
              </Link>
              <Badge tone="brand" className="mt-4">Acceso al dashboard</Badge>
              <h2 className="mt-4 text-3xl font-bold text-primary">Login</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Inicia sesion con el usuario real que configuraste en Supabase.
              </p>
            </div>

            <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
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

              {errorMessage ? (
                <div className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-semibold text-danger">
                  {errorMessage}
                </div>
              ) : null}

              <Button type="submit" size="lg" isLoading={isSubmitting} disabled={!email || !password}>
                Entrar al panel
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </main>
  );
}
