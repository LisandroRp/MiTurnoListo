import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";

import ts from "typescript";

const require = createRequire(import.meta.url);
const fileUrl = new URL("./AuthProvider.tsx", import.meta.url);
const output = ts.transpileModule(readFileSync(fileUrl, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: fileUrl.pathname
}).outputText;

test("an existing account enters after sign-in without waiting for workspace bootstrap", async () => {
  const stateChanges = [];
  let bootstrapCalls = 0;
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
    "@/lib/analytics/meta": { trackMetaEvent: () => {} }
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
    assert.deepEqual(stateChanges.at(-1), {
      status: "authenticated",
      userEmail: "owner@example.com",
      userId: "user-1"
    });
  } finally {
    globalThis.window = previousWindow;
  }
});
