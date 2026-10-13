"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { FiArrowLeft } from "react-icons/fi";

import { BrandMark } from "@/components/composed/BrandMark";
import { PublicSupportContact } from "@/components/composed/PublicSupportContact";
import { WorkspaceLoadingState } from "@/components/composed/WorkspaceLoadingState";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";
import { useAuth } from "@/features/auth/components/AuthProvider";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { SignUpForm } from "@/features/auth/components/SignUpForm";
import { storePendingReferralCode } from "@/lib/networking/endpoints/auth";

type AuthMode = "login" | "signup" | "forgot" | "recovery";

const authCopy = {
  login: {
    sideBadge: "Acceso seguro",
    sideTitle: "Entrá y dejá que la agenda trabaje por vos.",
    sideDescription: "Gestioná turnos, servicios, equipo y cobros desde un panel simple pensado para tu negocio.",
    cardBadge: "Acceso al dashboard",
    cardTitle: "Iniciar sesión",
    cardDescription: "Ingresá con tu mail y contraseña para entrar al panel.",
    switchPrompt: "¿No tenés cuenta?",
    switchLabel: "Crear cuenta"
  },
  signup: {
    sideBadge: "Nuevo acceso",
    sideTitle: "Creá tu cuenta y empezá a ordenar tus turnos desde hoy.",
    sideDescription: "Configurá tu espacio en minutos y dejá lista una agenda online para que tus clientes puedan reservar.",
    sideFooterTitle: "Antes de arrancar",
    sideFooterLines: [
      "Usá un mail al que tengas acceso.",
      "Si te pedimos confirmación, revisá tu casilla para activar la cuenta."
    ],
    cardBadge: "Alta de cuenta",
    cardTitle: "Crear cuenta",
    cardDescription: "Creá un usuario nuevo para entrar al panel con tus propias credenciales.",
    switchPrompt: "¿Ya tenés cuenta?",
    switchLabel: "Iniciar sesión"
  },
  forgot: {
    sideBadge: "Recuperar acceso",
    sideTitle: "Recuperá el acceso a tu agenda.",
    sideDescription: "Te mandamos un mail con un enlace para restablecer tu contraseña.",
    sideFooterTitle: "Antes de enviarlo",
    sideFooterLines: [
      "Usá el mismo mail con el que entrás al panel.",
      "Abrí el enlace desde el dispositivo donde estás trabajando."
    ],
    cardBadge: "Recuperación por mail",
    cardTitle: "Olvidé mi contraseña",
    cardDescription: "Ingresá tu mail y te enviamos un enlace para crear una nueva contraseña.",
    switchPrompt: "¿Recordaste tu contraseña?",
    switchLabel: "Volver a iniciar sesión"
  },
  recovery: {
    sideBadge: "Recuperación activa",
    sideTitle: "Definí tu nueva contraseña y volvé a entrar.",
    sideDescription: "Cuando abras el enlace del mail, volvés a esta pantalla para completar el cambio.",
    sideFooterTitle: "Importante",
    sideFooterLines: [
      "El enlace de recuperación es temporal.",
      "Si vence, podés pedir otro desde el inicio de sesión."
    ],
    cardBadge: "Nueva contraseña",
    cardTitle: "Actualizar contraseña",
    cardDescription: "Elegí una nueva contraseña para tu cuenta y luego volvé a iniciar sesión.",
    switchPrompt: "¿Necesitás otro enlace?",
    switchLabel: "Pedir otro enlace"
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
    storePendingReferralCode(searchParams.get("ref"));
  }, [searchParams]);

  useEffect(() => {
    if (status === "authenticated" && mode !== "recovery") {
      router.replace(nextPath);
    }
  }, [mode, nextPath, router, status]);

  if (status === "loading" || status === "bootstrapping" || (status === "authenticated" && mode !== "recovery")) {
    return <WorkspaceLoadingState title={status === "bootstrapping" ? "Cargando tu espacio..." : "Verificando tu sesión..."} />;
  }

  return (
    <>
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
      <PublicSupportContact />
    </>
  );
}
