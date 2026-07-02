"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/networking/clients/supabase-browser";

const persistentSessionKey = "myagenda_persist_session";
const transientSessionKey = "myagenda_transient_session";

type AuthStatus = "loading" | "authenticated" | "guest";

type AuthContextValue = {
  status: AuthStatus;
  userId: string | null;
  userEmail: string | null;
  login: (email: string, password: string, rememberSession: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<{ status: AuthStatus; userEmail: string | null; userId: string | null }>({
    status: "loading",
    userEmail: null,
    userId: null
  });

  async function syncAuthState() {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setAuthState({ status: "guest", userEmail: null, userId: null });
      return;
    }

    const hasPersistentSession = window.localStorage.getItem(persistentSessionKey) === "true";
    const hasTransientSession = window.sessionStorage.getItem(transientSessionKey) === "true";

    if (!hasPersistentSession && !hasTransientSession) {
      await supabase.auth.signOut();
      setAuthState({ status: "guest", userEmail: null, userId: null });
      return;
    }

    setAuthState({
      status: "authenticated",
      userEmail: session.user.email ?? null,
      userId: session.user.id
    });
  }

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const syncTimer = window.setTimeout(() => {
      void syncAuthState();
    }, 0);

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
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
      window.localStorage.removeItem(persistentSessionKey);
      window.sessionStorage.removeItem(transientSessionKey);
      return false;
    }

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

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.localStorage.removeItem(persistentSessionKey);
    window.sessionStorage.removeItem(transientSessionKey);
    setAuthState({ status: "guest", userEmail: null, userId: null });
  }

  return (
    <AuthContext.Provider
      value={{
        status: authState.status,
        userId: authState.userId,
        userEmail: authState.userEmail,
        login,
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
