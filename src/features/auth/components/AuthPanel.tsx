"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { FiArrowLeft } from "react-icons/fi";

import { BrandMark } from "@/components/composed/BrandMark";
import { WorkspaceLoadingState } from "@/components/composed/WorkspaceLoadingState";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { SignUpForm } from "@/features/auth/components/SignUpForm";

type AuthMode = "login" | "signup" | "forgot" | "recovery";

const authCopy = {
  login: {
    sideBadge: "Supabase Auth",
    sideTitle: "Entra y deja que la agenda trabaje por vos.",
    sideDescription: "Ahora el acceso usa tu usuario real y el panel ya apunta a la base de datos que cargaste en Supabase.",
    cardBadge: "Acceso al dashboard",
    cardTitle: "Login",
    cardDescription: "Inicia sesion con el usuario real que configuraste en Supabase.",
    switchPrompt: "No tenes cuenta?",
    switchLabel: "Crear cuenta"
  },
  signup: {
    sideBadge: "Nuevo acceso",
    sideTitle: "Crea tu cuenta y empeza a ordenar tus turnos desde hoy.",
    sideDescription: "Preparamos el alta para que puedas registrarte con Supabase sin salir del flujo del dashboard.",
    sideFooterTitle: "Antes de arrancar",
    sideFooterLines: [
      "Usa un mail al que tengas acceso real.",
      "Si Supabase pide confirmacion, te vamos a avisar para que revises la casilla."
    ],
    cardBadge: "Alta de cuenta",
    cardTitle: "Sign up",
    cardDescription: "Crea un usuario nuevo para entrar al panel con tus propias credenciales.",
    switchPrompt: "Ya tenes cuenta?",
    switchLabel: "Iniciar sesion"
  },
  forgot: {
    sideBadge: "Reset password",
    sideTitle: "Recupera el acceso sin salir de tu agenda.",
    sideDescription: "Te mandamos un mail seguro con el link para volver a definir tu password en Supabase.",
    sideFooterTitle: "Antes de enviarlo",
    sideFooterLines: [
      "Usa el mismo mail con el que entras al panel.",
      "Abre el link desde el dispositivo donde estas trabajando."
    ],
    cardBadge: "Recuperacion por mail",
    cardTitle: "Reset password",
    cardDescription: "Ingresa tu mail y te enviamos un enlace para crear una nueva password.",
    switchPrompt: "Recordaste tu password?",
    switchLabel: "Volver al login"
  },
  recovery: {
    sideBadge: "Recuperacion activa",
    sideTitle: "Define tu nueva password y vuelve a entrar.",
    sideDescription: "Cuando abras el link del mail, Supabase te trae de vuelta a esta pantalla para cerrar el cambio.",
    sideFooterTitle: "Importante",
    sideFooterLines: [
      "El link de recuperacion es temporal.",
      "Si vence, puedes pedir otro reset desde el login."
    ],
    cardBadge: "Nueva password",
    cardTitle: "Actualizar password",
    cardDescription: "Elige una nueva clave para tu cuenta y luego vuelve a iniciar sesion.",
    switchPrompt: "Necesitas otro link?",
    switchLabel: "Pedir nuevo reset"
  }
} as const;

function getSafeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/inicio";
  }

  return nextPath;
}

function getMode(modeParam: string | null): AuthMode {
  if (modeParam === "signup" || modeParam === "forgot" || modeParam === "recovery") {
    return modeParam;
  }

  return "login";
}

function createModeHref(mode: AuthMode, nextPath: string) {
  const params = new URLSearchParams();
  params.set("mode", mode);

  if (nextPath !== "/inicio") {
    params.set("next", nextPath);
  }

  return `/login?${params.toString()}`;
}

export function AuthPanel() {
  const { status } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = getMode(searchParams.get("mode"));
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const copy = authCopy[mode];
  const alternateMode =
    mode === "login"
      ? "signup"
      : mode === "signup"
        ? "login"
        : mode === "forgot"
          ? "login"
          : "forgot";
  const loginHref = createModeHref("login", nextPath);
  const forgotPasswordHref = createModeHref("forgot", nextPath);

  useEffect(() => {
    if (status === "authenticated" && mode !== "recovery") {
      router.replace(nextPath);
    }
  }, [mode, nextPath, router, status]);

  if (status === "loading" || (status === "authenticated" && mode !== "recovery")) {
    return <WorkspaceLoadingState title="Verificando tu sesion..." />;
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
          <Badge tone="brand" className="mt-4">{copy.sideBadge}</Badge>
          <h1 className="mt-5 text-5xl font-bold leading-tight text-primary">
            {copy.sideTitle}
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted">
            {copy.sideDescription}
          </p>
        </div>
        {"sideFooterTitle" in copy ? (
          <div className="grid gap-3 text-sm text-muted">
            <p className="font-semibold text-primary">{copy.sideFooterTitle}</p>
            {copy.sideFooterLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : <span />}
      </section>

      <section
        className={cx(
          "mx-auto flex w-full max-w-md lg:max-w-none lg:justify-center",
          mode === "signup" ? "items-start py-3 lg:items-center lg:py-0" : "items-center"
        )}
      >
        <div className="w-full lg:max-w-md">
          <Link href="/" className="mb-6 flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-muted hover:text-primary lg:hidden">
            <FiArrowLeft aria-hidden="true" />
            Volver
          </Link>
          <Card className={cx("bg-sidebar p-6 sm:p-8", mode === "signup" ? "my-5 sm:my-11" : "")}>
            <div>
              <Link href="/" className="w-fit">
                <BrandMark variant="compact" size="lg" priority />
              </Link>
              <Badge tone="brand" className="mt-4">{copy.cardBadge}</Badge>
              <h2 className="mt-4 text-3xl font-bold text-primary">{copy.cardTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {copy.cardDescription}
              </p>
            </div>

            <div className="mt-7">
              {mode === "login" ? (
                <LoginForm
                  nextPath={nextPath}
                  forgotPasswordHref={forgotPasswordHref}
                />
              ) : mode === "signup" ? (
                <SignUpForm nextPath={nextPath} />
              ) : mode === "forgot" ? (
                <ForgotPasswordForm />
              ) : (
                <ResetPasswordForm forgotPasswordHref={forgotPasswordHref} loginHref={loginHref} />
              )}
            </div>

            <p className="mt-6 text-sm text-muted-strong">
              {copy.switchPrompt}{" "}
              <Link
                href={createModeHref(alternateMode, nextPath)}
                className="font-semibold !text-brand-hover underline decoration-brand-hover/45 underline-offset-4 hover:!text-brand-strong"
              >
                {copy.switchLabel}
              </Link>
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
