"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { supabaseBrowserStorage, supabaseBrowserStorageKey } from "@/lib/networking/clients/supabase-browser-storage";

let supabaseBrowserClient: SupabaseClient | null = null;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getRequiredEnv(value: string | undefined, name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY") {
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getSupabaseBrowserClient() {
  if (supabaseBrowserClient) {
    return supabaseBrowserClient;
  }

  supabaseBrowserClient = createClient(
    getRequiredEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: supabaseBrowserStorage,
        storageKey: supabaseBrowserStorageKey
      }
    }
  );

  return supabaseBrowserClient;
}
