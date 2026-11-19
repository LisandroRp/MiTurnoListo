import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as referralRules from "../../../lib/referral-rules.ts";

const require = createRequire(import.meta.url);
const file = new URL("./page.tsx", import.meta.url);
const output = ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
function profilePage(initialProfile) {
  const states = [], effects = [];
  let cursor = 0, completeSummary;
  const pendingSummary = new Promise((resolve) => { completeSummary = resolve; });
  const hooks = {
    ...require("react"),
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useEffect(callback) { effects.push(callback); },
    useRef: () => ({ current: false })
  };
  const mocks = {
    react: hooks,
    "next/navigation": { usePathname: () => "/perfil", useRouter: () => ({ replace() {} }), useSearchParams: () => new URLSearchParams() },
    "@/features/auth/components/AuthProvider": { useAuth: () => ({ userEmail: "owner@example.test" }) },
    "@/features/scheduling/components/ProfileView": { ProfileView: () => null },
    "@/features/scheduling/components/SchedulingProvider": { useScheduling: () => ({ profile: initialProfile, businessId: "business", messages: { profile: {} } }) },
    "@/lib/referral-rules": referralRules,
    "@/lib/networking/endpoints/referrals": { getReferralSummary: () => pendingSummary },
    "@/lib/networking/endpoints/super-admin": { getSuperAdminStatus: async () => false }
  };
  const loaded = new Module(file.pathname);
  loaded.require = (name) => mocks[name] ?? require(name);
  loaded._compile(output, file.pathname);
  const render = () => { cursor = 0; effects.length = 0; return loaded.exports.default(); };
  return { render, completeSummary, effects };
}

test("delayed referral loading never relabels paid or manual Infinity as Pro", async () => {
  for (const source of ["manual", "paid"]) {
    for (const serverTier of [undefined, "unlimited"]) {
      const app = profilePage({ subscriptionTier: "unlimited", subscriptionAccessSource: source });
      assert.equal(app.render().props.profile.subscriptionTier, "unlimited");
      app.effects.forEach((effect) => effect());
      app.completeSummary({ subscriptionAccessSource: source, ...(serverTier ? { subscriptionTier: serverTier } : {}), availableRewardCount: 0 });
      await new Promise((resolve) => setImmediate(resolve));
      const updated = app.render();
      assert.equal(updated.props.profile.subscriptionTier, "unlimited");
      assert.equal(updated.props.isReferralSummaryLoading, false);
    }
  }
});

test("an authoritative referral expiry response updates the displayed tier without retaining expired Infinity", async () => {
  const app = profilePage({ subscriptionTier: "unlimited", subscriptionAccessSource: "referral" });
  app.render();
  app.effects.forEach((effect) => effect());
  app.completeSummary({ subscriptionTier: "free", subscriptionAccessSource: "free", availableRewardCount: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.render().props.profile.subscriptionTier, "free");
});
