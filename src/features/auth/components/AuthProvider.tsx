"use client";

import { createContext, ReactNode, useContext, useEffect, useEffectEvent, useRef, useState } from "react";
import type { AuthChangeEvent } from "@supabase/supabase-js";

import {
  clearSupabaseBrowserAuthStorage,
  clearSupabaseSessionPersistence,
  hasSupabaseSessionPersistence,
  setSupabaseSessionPersistence
} from "@/lib/networking/clients/supabase-browser-storage";
import { getSupabaseBrowserClient } from "@/lib/networking/clients/supabase-browser";
import { bootstrapWorkspace } from "@/lib/networking/endpoints/auth";
import { getPayloadErrorMessage } from "@/lib/networking/response-errors";

const passwordRecoverySessionKey = "miturnolisto_password_recovery";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const emailNotConfirmedCode = "email_not_confirmed";

type AuthStatus = "loading" | "bootstrapping" | "authenticated" | "guest" | "recovery";

type LoginResult =
  | { status: "authenticated" }
  | { status: "email_not_confirmed"; email: string; message: string }
  | { status: "error"; message: string };

type SignUpResult =
  | { status: "authenticated" }
  | { status: "confirmation_required"; email: string }
  | { status: "error"; message: string };

type PasswordResetRequestResult =
  | { status: "success"; email: string }
  | { status: "error"; message: string };

type PasswordUpdateResult =
  | { status: "success" }
  | { status: "error"; message: string };

type AuthContextValue = {
  status: AuthStatus;
  userId: string | null;
  userEmail: string | null;
  login: (email: string, password: string, rememberSession: boolean) => Promise<LoginResult>;
  signUp: (email: string, password: string, rememberSession: boolean) => Promise<SignUpResult>;
  resendEmailConfirmation: (email: string) => Promise<PasswordResetRequestResult>;
  requestPasswordReset: (email: string) => Promise<PasswordResetRequestResult>;
  updatePassword: (password: string) => Promise<PasswordUpdateResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const isAuthActionInProgress = useRef(false);
  const isBootstrappingWorkspace = useRef(false);
  const [authState, setAuthState] = useState<{ status: AuthStatus; userEmail: string | null; userId: string | null }>({
    status: "loading",
    userEmail: null,
    userId: null
  });

  function clearRecoverySession() {
    window.sessionStorage.removeItem(passwordRecoverySessionKey);
  }

  function markPasswordRecoverySession() {
    window.sessionStorage.setItem(passwordRecoverySessionKey, "true");
  }

  function clearLocalAuthStorage() {
    clearSupabaseBrowserAuthStorage();
    clearRecoverySession();
  }

  function clearAllAuthState() {
    clearLocalAuthStorage();
    clearSupabaseSessionPersistence();
  }

  function getPasswordResetRedirectUrl() {
    const fallbackOrigin = window.location.origin;
    const baseUrl = (siteUrl ?? fallbackOrigin).trim().replace(/\/+$/, "");

    return `${baseUrl}/login?mode=recovery`;
  }

  function getEmailConfirmationRedirectUrl() {
    const fallbackOrigin = window.location.origin;
    const baseUrl = (siteUrl ?? fallbackOrigin).trim().replace(/\/+$/, "");

    return `${baseUrl}/login?confirmed=1`;
  }

  function hasPasswordRecoveryReturn() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    return searchParams.get("mode") === "recovery" || searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery";
  }

  function hasEmailConfirmationReturn() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    return searchParams.get("confirmed") === "1" ||
      searchParams.get("type") === "signup" ||
      searchParams.get("type") === "email" ||
      hashParams.get("type") === "signup" ||
      hashParams.get("type") === "email" ||
      hashParams.has("access_token") ||
      hashParams.has("refresh_token") ||
      searchParams.has("code");
  }

  const syncAuthState = useEffectEvent(async () => {
    if (isAuthActionInProgress.current || isBootstrappingWorkspace.current) {
      return;
    }

    const hasRecoveryReturn = hasPasswordRecoveryReturn();
    const hasConfirmationReturn = hasEmailConfirmationReturn();
    const hasStoredPasswordRecoverySession = window.sessionStorage.getItem(passwordRecoverySessionKey) === "true";
    const hasRememberedSession = hasSupabaseSessionPersistence();

    if (!hasRecoveryReturn && !hasConfirmationReturn && !hasStoredPasswordRecoverySession && !hasRememberedSession) {
      clearAllAuthState();
      setAuthState({ status: "guest", userEmail: null, userId: null });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      clearAllAuthState();
      setAuthState({ status: "guest", userEmail: null, userId: null });
      return;
    }

    if (hasRecoveryReturn) {
      markPasswordRecoverySession();
    }

    const hasPasswordRecoverySession = hasRecoveryReturn || hasStoredPasswordRecoverySession;

    if (hasConfirmationReturn && !hasPasswordRecoverySession) {
      isBootstrappingWorkspace.current = true;
      setAuthState({
        status: "bootstrapping",
        userEmail: session.user.email ?? null,
        userId: session.user.id
      });

      try {
        await bootstrapWorkspace(session.access_token);
      } catch {
        isBootstrappingWorkspace.current = false;
        await supabase.auth.signOut({ scope: "local" });
        clearAllAuthState();
        setAuthState({ status: "guest", userEmail: null, userId: null });
        return;
      }

      isBootstrappingWorkspace.current = false;
    }

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(session.access_token);

    if (userError || !user) {
      clearAllAuthState();
      setAuthState({ status: "guest", userEmail: null, userId: null });
      return;
    }

    setAuthState({
      status: hasPasswordRecoverySession
        ? "recovery"
        : isBootstrappingWorkspace.current
          ? "bootstrapping"
          : "authenticated",
      userEmail: user.email ?? null,
      userId: user.id
    });
  });

  const handleAuthEvent = useEffectEvent((event: AuthChangeEvent) => {
    if (event === "PASSWORD_RECOVERY") {
      markPasswordRecoverySession();
      return;
    }

    if (event === "SIGNED_OUT") {
      clearAllAuthState();
      return;
    }

    if (event === "SIGNED_IN") {
      clearRecoverySession();
    }
  });

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const syncTimer = window.setTimeout(() => {
      void syncAuthState();
    }, 0);

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      handleAuthEvent(event);
      void syncAuthState();
    });

    return () => {
      window.clearTimeout(syncTimer);
      subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string, rememberSession: boolean): Promise<LoginResult> {
    setSupabaseSessionPersistence(rememberSession);
    isAuthActionInProgress.current = true;
    const supabase = getSupabaseBrowserClient();
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (error || !data.user) {
      isAuthActionInProgress.current = false;
      setAuthState({ status: "guest", userEmail: null, userId: null });
      clearLocalAuthStorage();
      if (error?.code === emailNotConfirmedCode) {
        return {
          status: "email_not_confirmed",
          email: normalizedEmail,
          message: "Tu email todavia no esta confirmado. Revisa tu casilla y confirma la cuenta antes de iniciar sesion."
        };
      }

      return {
        status: "error",
        message: "Credenciales incorrectas. Revisa tu mail y password e intenta otra vez."
      };
    }

    isAuthActionInProgress.current = false;
    isBootstrappingWorkspace.current = true;
    setAuthState((current) => ({ ...current, status: "bootstrapping" }));

    try {
      await bootstrapWorkspace(data.session?.access_token);
    } catch (bootstrapError) {
      isBootstrappingWorkspace.current = false;
      await signOutLocally();
      return {
        status: "error",
        message: getErrorMessage(bootstrapError, "No pudimos preparar tu espacio. Intenta otra vez.")
      };
    }

    clearRecoverySession();
    isBootstrappingWorkspace.current = false;
    setAuthState({
      status: "authenticated",
      userEmail: data.user.email ?? null,
      userId: data.user.id
    });

    return { status: "authenticated" };
  }

  async function signUp(email: string, password: string, rememberSession: boolean): Promise<SignUpResult> {
    setSupabaseSessionPersistence(rememberSession);
    isAuthActionInProgress.current = true;
    const supabase = getSupabaseBrowserClient();
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getEmailConfirmationRedirectUrl()
      }
    });

    if (error) {
      isAuthActionInProgress.current = false;
      setAuthState({ status: "guest", userEmail: null, userId: null });
      clearLocalAuthStorage();
      return {
        status: "error",
        message: error.message || "No pudimos crear la cuenta. Intenta otra vez."
      };
    }

    if (data.user && !data.session && data.user.identities && data.user.identities.length === 0) {
      isAuthActionInProgress.current = false;
      clearLocalAuthStorage();
      setAuthState({ status: "guest", userEmail: null, userId: null });

      return {
        status: "error",
        message: "Ya existe una cuenta con ese email. Inicia sesion o usa otro correo."
      };
    }

    if (data.session?.user) {
      isAuthActionInProgress.current = false;
      isBootstrappingWorkspace.current = true;
      setAuthState((current) => ({ ...current, status: "bootstrapping" }));

      try {
        await bootstrapWorkspace(data.session.access_token);
      } catch (bootstrapError) {
        isBootstrappingWorkspace.current = false;
        await signOutLocally();
        return {
          status: "error",
          message: getErrorMessage(bootstrapError, "No pudimos preparar tu espacio. Intenta otra vez.")
        };
      }

      clearRecoverySession();
      isBootstrappingWorkspace.current = false;
      setAuthState({
        status: "authenticated",
        userEmail: data.session.user.email ?? null,
        userId: data.session.user.id
      });

      return { status: "authenticated" };
    }

    if (data.user) {
      isAuthActionInProgress.current = false;
      clearLocalAuthStorage();
      setAuthState({ status: "guest", userEmail: null, userId: null });

      return {
        status: "confirmation_required",
        email: data.user.email ?? normalizedEmail
      };
    }

    isAuthActionInProgress.current = false;
    setAuthState({ status: "guest", userEmail: null, userId: null });

    return {
      status: "error",
      message: "No pudimos crear la cuenta. Intenta otra vez."
    };
  }

  async function resendEmailConfirmation(email: string): Promise<PasswordResetRequestResult> {
    const supabase = getSupabaseBrowserClient();
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: getEmailConfirmationRedirectUrl()
      }
    });

    if (error) {
      return {
        status: "error",
        message: error.message || "No pudimos reenviar el mail de confirmacion. Intenta otra vez."
      };
    }

    return {
      status: "success",
      email: normalizedEmail
    };
  }

  async function requestPasswordReset(email: string): Promise<PasswordResetRequestResult> {
    const supabase = getSupabaseBrowserClient();
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: getPasswordResetRedirectUrl()
    });

    if (error) {
      return {
        status: "error",
        message: error.message || "No pudimos enviar el mail de recuperacion. Intenta otra vez."
      };
    }

    return {
      status: "success",
      email: normalizedEmail
    };
  }

  async function updatePassword(password: string): Promise<PasswordUpdateResult> {
    if (authState.status !== "recovery") {
      return {
        status: "error",
        message: "El enlace de recuperacion ya no es valido. Solicita uno nuevo."
      };
    }

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return {
        status: "error",
        message: error.message || "No pudimos actualizar la password. Intenta otra vez."
      };
    }

    await signOutLocally();
    setAuthState({ status: "guest", userEmail: null, userId: null });

    return { status: "success" };
  }

  async function logout() {
    await signOutLocally();
    setAuthState({ status: "guest", userEmail: null, userId: null });
  }

  async function signOutLocally() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut({ scope: "local" });
    clearAllAuthState();
  }

  return (
    <AuthContext.Provider
      value={{
        status: authState.status,
        userId: authState.userId,
        userEmail: authState.userEmail,
        login,
        signUp,
        resendEmailConfirmation,
        requestPasswordReset,
        updatePassword,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return getPayloadErrorMessage(error, fallbackMessage);
}
