"use client";

import { createContext, ReactNode, useContext, useEffect, useEffectEvent, useState } from "react";
import type { AuthChangeEvent } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/networking/clients/supabase-browser";

const persistentSessionKey = "miturnolisto_persist_session";
const transientSessionKey = "miturnolisto_transient_session";
const passwordRecoverySessionKey = "miturnolisto_password_recovery";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

type AuthStatus = "loading" | "authenticated" | "guest" | "recovery";

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
  login: (email: string, password: string, rememberSession: boolean) => Promise<boolean>;
  signUp: (email: string, password: string, rememberSession: boolean) => Promise<SignUpResult>;
  requestPasswordReset: (email: string) => Promise<PasswordResetRequestResult>;
  updatePassword: (password: string) => Promise<PasswordUpdateResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<{ status: AuthStatus; userEmail: string | null; userId: string | null }>({
    status: "loading",
    userEmail: null,
    userId: null
  });

  function clearSessionFlags() {
    window.localStorage.removeItem(persistentSessionKey);
    window.sessionStorage.removeItem(transientSessionKey);
    window.sessionStorage.removeItem(passwordRecoverySessionKey);
  }

  function markPasswordRecoverySession() {
    window.localStorage.removeItem(persistentSessionKey);
    window.sessionStorage.removeItem(transientSessionKey);
    window.sessionStorage.setItem(passwordRecoverySessionKey, "true");
  }

  function getPasswordResetRedirectUrl() {
    const fallbackOrigin = window.location.origin;
    const baseUrl = (siteUrl ?? fallbackOrigin).trim().replace(/\/+$/, "");

    return `${baseUrl}/login?mode=recovery`;
  }

  function hasPasswordRecoveryReturn() {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    return searchParams.get("mode") === "recovery" || searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery";
  }

  const syncAuthState = useEffectEvent(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setAuthState({ status: "guest", userEmail: null, userId: null });
      return;
    }

    if (hasPasswordRecoveryReturn()) {
      markPasswordRecoverySession();
    }

    const hasPersistentSession = window.localStorage.getItem(persistentSessionKey) === "true";
    const hasTransientSession = window.sessionStorage.getItem(transientSessionKey) === "true";
    const hasPasswordRecoverySession = window.sessionStorage.getItem(passwordRecoverySessionKey) === "true";

    if (!hasPersistentSession && !hasTransientSession && !hasPasswordRecoverySession) {
      await supabase.auth.signOut();
      setAuthState({ status: "guest", userEmail: null, userId: null });
      return;
    }

    setAuthState({
      status: hasPasswordRecoverySession ? "recovery" : "authenticated",
      userEmail: session.user.email ?? null,
      userId: session.user.id
    });
  });

  const handleAuthEvent = useEffectEvent((event: AuthChangeEvent) => {
    if (event === "PASSWORD_RECOVERY") {
      markPasswordRecoverySession();
      return;
    }

    if (event === "SIGNED_OUT") {
      clearSessionFlags();
      return;
    }

    if (event === "SIGNED_IN") {
      window.sessionStorage.removeItem(passwordRecoverySessionKey);
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

  async function login(email: string, password: string, rememberSession: boolean) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error || !data.user) {
      setAuthState({ status: "guest", userEmail: null, userId: null });
      clearSessionFlags();
      return false;
    }

    window.sessionStorage.removeItem(passwordRecoverySessionKey);

    if (rememberSession) {
      window.localStorage.setItem(persistentSessionKey, "true");
      window.sessionStorage.removeItem(transientSessionKey);
    } else {
      window.localStorage.removeItem(persistentSessionKey);
      window.sessionStorage.setItem(transientSessionKey, "true");
    }

    setAuthState({
      status: "authenticated",
      userEmail: data.user.email ?? null,
      userId: data.user.id
    });

    return true;
  }

  async function signUp(email: string, password: string, rememberSession: boolean): Promise<SignUpResult> {
    const supabase = getSupabaseBrowserClient();
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password
    });

    if (error) {
      setAuthState({ status: "guest", userEmail: null, userId: null });
      clearSessionFlags();
      return {
        status: "error",
        message: error.message || "No pudimos crear la cuenta. Intenta otra vez."
      };
    }

    if (data.user && !data.session && data.user.identities && data.user.identities.length === 0) {
      clearSessionFlags();
      setAuthState({ status: "guest", userEmail: null, userId: null });

      return {
        status: "error",
        message: "Ya existe una cuenta con ese email. Inicia sesion o usa otro correo."
      };
    }

    if (data.session?.user) {
      if (rememberSession) {
        window.localStorage.setItem(persistentSessionKey, "true");
        window.sessionStorage.removeItem(transientSessionKey);
      } else {
        window.localStorage.removeItem(persistentSessionKey);
        window.sessionStorage.setItem(transientSessionKey, "true");
      }

      setAuthState({
        status: "authenticated",
        userEmail: data.session.user.email ?? null,
        userId: data.session.user.id
      });

      return { status: "authenticated" };
    }

    if (data.user) {
      clearSessionFlags();
      setAuthState({ status: "guest", userEmail: null, userId: null });

      return {
        status: "confirmation_required",
        email: data.user.email ?? normalizedEmail
      };
    }

    return {
      status: "error",
      message: "No pudimos crear la cuenta. Intenta otra vez."
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

    clearSessionFlags();
    await supabase.auth.signOut();
    setAuthState({ status: "guest", userEmail: null, userId: null });

    return { status: "success" };
  }

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    clearSessionFlags();
    setAuthState({ status: "guest", userEmail: null, userId: null });
  }

  return (
    <AuthContext.Provider
      value={{
        status: authState.status,
        userId: authState.userId,
        userEmail: authState.userEmail,
        login,
        signUp,
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
