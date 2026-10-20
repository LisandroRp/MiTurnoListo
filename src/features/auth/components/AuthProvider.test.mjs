import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";

import ts from "typescript";
import { resetProUpgradePrompt } from "../../../lib/pro-upgrade-session.ts";

const require = createRequire(import.meta.url);
const fileUrl = new URL("./AuthProvider.tsx", import.meta.url);
const output = ts.transpileModule(readFileSync(fileUrl, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: fileUrl.pathname
}).outputText;

test("auth events defer and coalesce session reads until after the callback returns", async () => {
  const timers = new Map();
  const effects = [];
  let timerId = 0;
  let authCallback;
  let sessionReads = 0;
  let unsubscribed = false;
  const supabase = {
    auth: {
      getSession: async () => {
        sessionReads += 1;
        return { data: { session: null }, error: null };
      },
      onAuthStateChange: (callback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
      }
    }
  };
  const modules = {
    react: {
      createContext: () => ({ Provider: () => null }),
      useContext: () => null,
      useEffect: (callback) => effects.push(callback),
      useEffectEvent: (callback) => callback,
      useRef: (value) => ({ current: value }),
      useState: (value) => [value, () => {}]
    },
    "@/lib/networking/clients/supabase-browser": { getSupabaseBrowserClient: () => supabase },
    "@/lib/networking/clients/supabase-browser-storage": {
      hasSupabaseSessionPersistence: () => true,
      clearSupabaseBrowserAuthStorage: () => {},
      clearSupabaseSessionPersistence: () => {}
    },
    "@/lib/networking/endpoints/auth": {},
    "@/lib/networking/response-errors": {},
    "@/lib/analytics/ga": {},
    "@/lib/analytics/meta": {},
    "@/lib/pro-upgrade-session": { resetProUpgradePrompt }
  };
  const loaded = new Module(fileUrl.pathname);
  loaded.filename = fileUrl.pathname;
  loaded.require = (specifier) => modules[specifier] ?? require(specifier);
  loaded._compile(output, fileUrl.pathname);
  const previousWindow = globalThis.window;
  globalThis.window = {
    location: { search: "", hash: "" },
    sessionStorage: { getItem: () => null, removeItem: () => {} },
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id) => timers.delete(id)
  };
  try {
    loaded.exports.AuthProvider({ children: null });
    const cleanup = effects[0]();
    authCallback("INITIAL_SESSION");
    authCallback("TOKEN_REFRESHED");
    assert.equal(sessionReads, 0);
    assert.equal(timers.size, 1);
    const [id, callback] = [...timers][0];
    timers.delete(id);
    callback();
    await Promise.resolve();
    assert.equal(sessionReads, 1);
    authCallback("SIGNED_IN");
    cleanup();
    assert.equal(timers.size, 0);
    assert.equal(unsubscribed, true);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("an existing account enters after sign-in without waiting for workspace bootstrap", async () => {
  const stateChanges = [];
  let bootstrapCalls = 0;
  let promptResets = 0;
  const supabase = {
    auth: {
      signInWithPassword: async () => ({
        data: {
          session: { access_token: "session-token" },
          user: { id: "user-1", email: "owner@example.com" }
        },
        error: null
      })
    }
  };
  const react = {
    createContext: () => ({ Provider: () => null }),
    useContext: () => null,
    useEffect: () => {},
    useEffectEvent: (callback) => callback,
    useRef: (value) => ({ current: value }),
    useState: (value) => [value, (nextValue) => stateChanges.push(nextValue)]
  };
  const modules = {
    react,
    "@/lib/networking/clients/supabase-browser-storage": {
      clearSupabaseBrowserAuthStorage: () => {},
      clearSupabaseSessionPersistence: () => {},
      hasSupabaseSessionPersistence: () => true,
      setSupabaseSessionPersistence: () => {}
    },
    "@/lib/networking/clients/supabase-browser": { getSupabaseBrowserClient: () => supabase },
    "@/lib/networking/endpoints/auth": {
      bootstrapWorkspace: async () => { bootstrapCalls += 1; }
    },
    "@/lib/networking/response-errors": { getPayloadErrorMessage: () => "Request failed" },
    "@/lib/analytics/ga": { trackGoogleEvent: () => {} },
    "@/lib/analytics/meta": { trackMetaEvent: () => {} },
    "@/lib/pro-upgrade-session": { resetProUpgradePrompt: () => { promptResets += 1; } }
  };
  const componentModule = new Module(fileUrl.pathname);
  componentModule.filename = fileUrl.pathname;
  componentModule.require = (specifier) => modules[specifier] ?? require(specifier);
  componentModule._compile(output, fileUrl.pathname);

  const previousWindow = globalThis.window;
  globalThis.window = { sessionStorage: { removeItem: () => {} } };

  try {
    const element = componentModule.exports.AuthProvider({ children: null });
    const result = await element.props.value.login("owner@example.com", "password", true);

    assert.deepEqual(result, { status: "authenticated" });
    assert.equal(bootstrapCalls, 0);
    assert.equal(promptResets, 1);
    assert.deepEqual(stateChanges.at(-1), {
      status: "authenticated",
      userEmail: "owner@example.com",
      userId: "user-1"
    });
  } finally {
    globalThis.window = previousWindow;
  }
});
