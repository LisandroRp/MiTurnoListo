import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const fileUrl = new URL("./ProfileView.tsx", import.meta.url);
const output = ts.transpileModule(readFileSync(fileUrl, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: fileUrl.pathname
}).outputText;
const componentModule = new Module(fileUrl.pathname);
componentModule.filename = fileUrl.pathname;

const passthrough = (tag) => {
  function Passthrough({ children }) {
    return createElement(tag, null, children);
  }

  return Passthrough;
};
const components = {
  "@/components/ui/Badge": { Badge: passthrough("span") },
  "@/components/ui/Button": { Button: passthrough("button") },
  "@/components/ui/Card": { Card: passthrough("section") },
  "@/components/ui/ImageUploadField": { ImageUploadField: passthrough("div") },
  "@/components/ui/Modal": { Modal: () => null },
  "@/components/ui/SelectField": { SelectField: passthrough("div") },
  "@/components/ui/TextAreaField": { TextAreaField: passthrough("div") },
  "@/components/ui/TextField": { TextField: passthrough("div") },
  "@/components/composed/SectionHeader": { SectionHeader: passthrough("header") },
  "@/features/scheduling/components/ProfileSuperAdminPanel": { ProfileSuperAdminPanel: () => null },
  "@/features/scheduling/components/ProfileReferralRewardCallout": { ProfileReferralRewardCallout: () => null },
  "@/lib/networking/endpoints/super-admin": {},
  "@/lib/storage/business-assets": {},
  "react-icons/fi": Object.fromEntries([
    "FiArrowRight", "FiCheckCircle", "FiClock", "FiLock", "FiMapPin", "FiUpload", "FiX", "FiZap"
  ].map((name) => [name, passthrough("span")]))
};
componentModule.require = (specifier) => components[specifier] ?? require(specifier);
componentModule._compile(output, fileUrl.pathname);

const { ProfileView } = componentModule.exports;
const profile = {
  firstName: "Example",
  lastName: "Owner",
  email: "owner@example.com",
  subscriptionTier: "pro",
  subscriptionAccessSource: "paid",
  referralSummary: { activeDaysRemaining: 0, availableRewardCount: 0 },
  businessName: "Example business",
  businessSlug: "example",
  address: "",
  publicDescription: "",
  publicLogoUrl: "",
  publicOpeningHours: "",
  avatarUrl: ""
};
const messages = {
  actions: {},
  profile: {
    plan: "Plan",
    proPlan: "Pro",
    freePlan: "Free",
    currentPlan: "Current plan",
    proPlanFeatures: [],
    freePlanFeatures: []
  },
  themes: {}
};

function render(isReferralSummaryLoading, currentProfile = profile) {
  return renderToStaticMarkup(createElement(ProfileView, {
    messages,
    profile: currentProfile,
    businessId: "business-1",
    isSuperAdmin: false,
    hasReferralSummaryError: false,
    isReferralSummaryLoading,
    locale: "es",
    theme: "coral",
    themeOptions: [],
    onRequestPasswordReset: async () => {},
    onLocaleChange: () => {},
    onSaveBusinessProfile: async () => true,
    onSaveProfileAvatar: async () => true,
    onThemeChange: () => {},
    onBusinessImageUploadError: () => {},
    onSubscribeToPro: async () => {},
    onUnsubscribeFromPro: async () => true,
    onActivateReferralReward: async () => true
  }));
}

function getPlanCards(html) {
  return [...html.matchAll(/<button[^>]*class="([^"]*rounded-2xl border p-5[^"]*)"[^>]*>([\s\S]*?)<\/button>/g)];
}

test("shows the known Pro tier while referral details are still loading", () => {
  const loadingHtml = render(true);
  const loadedHtml = render(false);
  const [freeCard, proCard] = getPlanCards(loadingHtml);

  assert.match(loadingHtml, />Plan<\/p><p[^>]*>Pro<\/p>/);
  assert.doesNotMatch(freeCard[1], /border-brand bg-brand-soft/);
  assert.match(proCard[1], /border-brand bg-brand-soft/);
  assert.match(proCard[2], /Current plan/);
  assert.match(loadedHtml, /Current plan/);
});

test("marks the known Free plan while referral details are still loading", () => {
  const html = render(true, {
    ...profile,
    subscriptionTier: "free",
    subscriptionAccessSource: "free"
  });
  const [freeCard, proCard] = getPlanCards(html);

  assert.match(html, />Plan<\/p><p[^>]*>Free<\/p>/);
  assert.match(freeCard[1], /border-brand bg-brand-soft/);
  assert.match(freeCard[2], /Current plan/);
  assert.doesNotMatch(proCard[1], /border-brand bg-brand-soft/);
});

test("does not mark the paid Pro card as current for referral Pro", () => {
  const html = render(false, {
    ...profile,
    subscriptionAccessSource: "referral"
  });
  const [, proCard] = getPlanCards(html);

  assert.doesNotMatch(html, /Current plan/);
  assert.doesNotMatch(proCard[1], /border-brand bg-brand-soft/);
});

test("an upgrade link opens the purchase modal for Free accounts without starting checkout", () => {
  for (const tier of ["free", "pro"]) {
    const states = [];
    const effects = [];
    let cursor = 0;
    let checkoutCalls = 0;
    let consumed = 0;
    const react = {
      ...require("react"),
      useState: (initial) => {
        const index = cursor++;
        if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
        return [states[index], (value) => { states[index] = value; }];
      },
      useEffect: (callback) => effects.push(callback),
      useRef: () => ({ current: null }),
      useCallback: (callback) => callback
    };
    const loaded = new Module(fileUrl.pathname);
    loaded.filename = fileUrl.pathname;
    loaded.require = (specifier) => specifier === "react" ? react : components[specifier] ?? require(specifier);
    loaded._compile(output, fileUrl.pathname);
    const previousWindow = globalThis.window;
    let timer;
    globalThis.window = { setTimeout: (callback) => { timer = callback; return 1; }, clearTimeout: () => {} };
    try {
      const props = {
        messages, profile: { ...profile, subscriptionTier: tier },
        isSuperAdmin: false, themeOptions: [], openProPlan: true,
        onProPlanOpened: () => { consumed += 1; },
        onSubscribeToPro: () => { checkoutCalls += 1; }
      };
      loaded.exports.ProfileView(props);
      effects[0]();
      timer();
      cursor = 0;
      const view = loaded.exports.ProfileView({ ...props, openProPlan: false });
      const modal = view.props.children.find((child) => child?.type === components["@/components/ui/Modal"].Modal);
      assert.equal(modal.props.isOpen, tier === "free");
      assert.equal(checkoutCalls, 0);
      assert.equal(consumed, 1);
    } finally {
      globalThis.window = previousWindow;
    }
  }
});
