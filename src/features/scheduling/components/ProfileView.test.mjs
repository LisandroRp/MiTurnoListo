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
const formattedUrl = new URL("../../../components/ui/FormattedText.tsx", import.meta.url);
const formattedModule = new Module(formattedUrl.pathname);
formattedModule.require = (name) => name === "@/components/ui/utils" ? { cx: (...values) => values.filter(Boolean).join(" ") } : require(name);
formattedModule._compile(ts.transpileModule(readFileSync(formattedUrl, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, formattedUrl.pathname);
const limitsUrl = new URL("../business-profile-limits.ts", import.meta.url);
const limitsModule = new Module(limitsUrl.pathname);
limitsModule._compile(ts.transpileModule(readFileSync(limitsUrl, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, limitsUrl.pathname);
const components = {
  "@/features/scheduling/business-profile-limits": limitsModule.exports,
  "@/components/ui/FormattingTextArea": { FormattingTextArea: passthrough("div") },
  "@/components/ui/FormattedText": formattedModule.exports,
  "@/components/ui/Badge": { Badge: passthrough("span") },
  "@/components/ui/Button": { Button: passthrough("button") },
  "@/components/ui/Card": { Card: passthrough("section") },
  "@/components/ui/ImageUploadField": { ImageUploadField: passthrough("div") },
  "@/components/ui/Modal": { Modal: () => null },
  "@/components/ui/SelectField": { SelectField: passthrough("div") },
  "@/components/ui/TextAreaField": { TextAreaField: passthrough("div") },
  "@/components/ui/TextField": { TextField: passthrough("div") },
  "@/components/composed/SectionHeader": { SectionHeader: ({ title, titleAccessory, actions }) => createElement("header", null, title, titleAccessory, actions) },
  "@/features/scheduling/components/ProfileSuperAdminPanel": { ProfileSuperAdminPanel: () => null },
  "@/features/scheduling/components/ProfileReferralRewardCallout": { ProfileReferralRewardCallout: () => null },
  "@/lib/networking/endpoints/super-admin": {},
  "@/lib/storage/business-assets": {},
  "react-icons/fi": Object.fromEntries([
    "FiArrowRight", "FiCheckCircle", "FiClock", "FiLock", "FiMapPin", "FiUser", "FiUpload", "FiX", "FiZap", "FiStar"
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
const messagesUrl = new URL("../i18n/messages.ts", import.meta.url);
const messagesModule = new Module(messagesUrl.pathname);
messagesModule._compile(ts.transpileModule(readFileSync(messagesUrl, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, messagesUrl.pathname);
const messages = messagesModule.exports.messages.es;

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

test("shows the known PRO tier while referral details are still loading", () => {
  const loadingHtml = render(true);
  const loadedHtml = render(false);
  const [freeCard, proCard] = getPlanCards(loadingHtml);

  assert.match(loadingHtml, /aria-label="Plan actual: PRO/);
  assert.doesNotMatch(freeCard[1], /border-brand bg-brand-soft/);
  assert.match(proCard[1], /border-brand bg-brand-soft/);
  assert.match(proCard[2], /Plan actual/);
  assert.match(loadedHtml, /Plan actual/);
});

test("marks the known Free plan while referral details are still loading", () => {
  const html = render(true, {
    ...profile,
    subscriptionTier: "free",
    subscriptionAccessSource: "free"
  });
  const [freeCard, proCard] = getPlanCards(html);

  assert.match(html, /aria-label="Plan actual: FREE/);
  assert.match(freeCard[1], /border-brand bg-brand-soft/);
  assert.match(freeCard[2], /Plan actual/);
  assert.doesNotMatch(proCard[1], /border-brand bg-brand-soft/);
});

test("does not mark the paid PRO card as current for referral PRO", () => {
  const html = render(false, {
    ...profile,
    subscriptionAccessSource: "referral"
  });
  const [, proCard] = getPlanCards(html);

  assert.doesNotMatch(proCard[2], /Plan actual/);
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

function interactiveProfile({ tier = "free", isSuperAdmin = false, accessSource } = {}) {
  const states = [], effects = [];
  let cursor = 0;
  const saved = [], resets = [];
  let checkoutCalls = 0;
  const react = {
    ...require("react"),
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useEffect: (callback) => effects.push(callback),
    useCallback: (callback) => callback,
    useRef: () => ({ current: null })
  };
  const loaded = new Module(fileUrl.pathname);
  loaded.filename = fileUrl.pathname;
  loaded.require = (specifier) => specifier === "react" ? react : components[specifier] ?? require(specifier);
  loaded._compile(output, fileUrl.pathname);
  const props = {
    messages, profile: { ...profile, subscriptionTier: tier, subscriptionAccessSource: accessSource ?? (tier === "free" ? "free" : "paid") },
    isSuperAdmin, themeOptions: [], businessId: "business-1",
    onSaveBusinessProfile: async (draft) => { saved.push(draft); return true; },
    onSubscribeToPro: async () => { checkoutCalls += 1; },
    onRequestPasswordReset: async (email) => { resets.push(email); }
  };
  let tree;
  const nodes = (node = tree) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children, node.props?.actions, node.props?.titleAccessory, node.props?.leftContent].flat(Infinity).filter((child) => child && typeof child === "object").flatMap((child) => nodes(child))];
  const render = () => { cursor = 0; effects.length = 0; tree = loaded.exports.ProfileView(props); };
  const button = (label) => nodes().find((node) => node.type === components["@/components/ui/Button"].Button && node.props.children === label);
  const panel = () => nodes().find((node) => node.type?.name === "BusinessProfilePanel");
  return { render, nodes, button, panel, saved, resets, checkoutCalls: () => checkoutCalls };
}

test("unified profile opens on editable business details with prominent plans and compact account details", () => {
  const app = interactiveProfile();
  app.render();
  assert.ok(app.panel());
  assert.ok(app.button(messages.upgrade.action));
  const all = app.nodes();
  assert.ok(all.findIndex((node) => node === app.panel()) < all.findIndex((node) => node.props?.id === "planes"));
  assert.ok(all.findIndex((node) => node.props?.id === "planes") < all.findIndex((node) => node.type === "h2" && node.props.children === messages.profile.account));
  assert.ok(all.some((node) => node.props?.children === profile.email));
  assert.equal(all.some((node) => node.props?.label === messages.profile.firstName || node.props?.label === messages.profile.lastName), false);
  assert.equal(all.some((node) => node.type?.name === "ProfileTabButton"), false);
  assert.equal(app.button(messages.profile.superAdminTab), undefined);
});

test("business edits save from the unified profile and account password reset remains available", async () => {
  const app = interactiveProfile();
  app.render();
  const panel = app.panel();
  panel.props.onChange({ ...panel.props.draft, name: "Updated clinic", address: "New address" });
  app.render();
  assert.equal(app.panel().props.draft.name, "Updated clinic");
  app.panel().props.onSave();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.saved[0].name, "Updated clinic");
  assert.equal(app.saved[0].address, "New address");
  app.button(messages.actions.changePassword).props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(app.resets, [profile.email]);
});

test("new upgrade action opens confirmation and starts checkout only after confirmation", async () => {
  const app = interactiveProfile();
  app.render();
  app.button(messages.upgrade.action).props.onClick();
  app.render();
  assert.equal(app.nodes().find((node) => node.type === components["@/components/ui/Modal"].Modal).props.isOpen, true);
  assert.equal(app.checkoutCalls(), 0);
  app.button(messages.profile.subscribeAction).props.onClick();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.checkoutCalls(), 1);
  const pro = interactiveProfile({ tier: "pro" });
  pro.render();
  assert.equal(pro.button(messages.upgrade.action), undefined);
  assert.ok(pro.nodes().some((node) => node.props?.["aria-label"]?.includes(messages.profile.viewPlans)));
});

test("super admin stays separate and returning preserves unsaved business edits", () => {
  const app = interactiveProfile({ isSuperAdmin: true });
  app.render();
  app.panel().props.onChange({ ...app.panel().props.draft, name: "Unsaved business" });
  app.render();
  app.button(messages.profile.superAdminTab).props.onClick();
  app.render();
  assert.equal(app.panel(), undefined);
  assert.ok(app.nodes().some((node) => node.type === components["@/features/scheduling/components/ProfileSuperAdminPanel"].ProfileSuperAdminPanel));
  app.button(messages.nav.profile).props.onClick();
  app.render();
  assert.equal(app.panel().props.draft.name, "Unsaved business");
});


test("left column keeps logo and referrals while public preview spans the profile", () => {
  const app = interactiveProfile();
  app.render();
  const all = app.nodes();
  const aside = all.find((node) => node.type === "aside");
  const sideNodes = app.nodes(aside);
  const logo = sideNodes.find((node) => node.type === components["@/components/ui/ImageUploadField"].ImageUploadField);
  assert.equal(logo.props.label, messages.profile.publicLogo);
  assert.equal(logo.props.layout, "stacked");
  assert.ok(sideNodes.some((node) => node.type === components["@/features/scheduling/components/ProfileReferralRewardCallout"].ProfileReferralRewardCallout));
  assert.equal(sideNodes.some((node) => node.props?.children === messages.profile.growWithPro), false);
  const preview = all.find((node) => node.type?.name === "BusinessPublicPreview");
  assert.ok(preview);
  assert.equal(preview.props.draft.name, profile.businessName);
  assert.ok(all.indexOf(preview) > all.indexOf(app.panel()));
  assert.ok(all.indexOf(preview) < all.findIndex((node) => node.props?.id === "planes"));
  const panelNodes = app.nodes(app.panel().type(app.panel().props));
  assert.equal(panelNodes.some((node) => node.type?.name === "BusinessPublicPreview"), false);
  assert.equal(panelNodes.filter((node) => node.type === components["@/components/ui/Card"].Card).length, 1);
  assert.equal(panelNodes.filter((node) => node.type === components["@/components/ui/Button"].Button && node.props.children === messages.actions.save).length, 1);
  assert.ok(panelNodes.some((node) => node.type === "h2" && node.props.children === messages.profile.business));
});

test("header tier badge scrolls to plans and Free has a separate animated upgrade action", () => {
  const previousWindow = globalThis.window;
  globalThis.window = { requestAnimationFrame: (callback) => callback() };
  try {
    for (const tier of ["free", "pro"]) {
      const app = interactiveProfile({ tier });
      app.render();
      const plans = app.nodes().find((node) => node.props?.id === "planes");
      let scrollOptions;
      plans.props.ref.current = { scrollIntoView: (options) => { scrollOptions = options; } };
      const header = app.nodes().find((node) => node.type === components["@/components/composed/SectionHeader"].SectionHeader);
      const badgeButton = app.nodes(header.props.titleAccessory).find((node) => node.type === "button");
      assert.ok(badgeButton.props["aria-label"].includes(tier === "pro" ? messages.profile.proPlan : messages.profile.freePlan));
      badgeButton.props.onClick();
      assert.deepEqual(scrollOptions, { behavior: "smooth", block: "start" });
      assert.equal(app.checkoutCalls(), 0);
      if (tier === "free") assert.match(app.button(messages.upgrade.action).props.className, /button-bounce/);
      else assert.equal(app.button(messages.upgrade.action), undefined);
    }
  } finally { globalThis.window = previousWindow; }
});

test("left logo editor shares the business draft and save action", async () => {
  const app = interactiveProfile();
  app.render();
  let aside = app.nodes().find((node) => node.type === "aside");
  const logo = app.nodes(aside).find((node) => node.type === components["@/components/ui/ImageUploadField"].ImageUploadField);
  logo.props.onChange("https://example.com/new-logo.webp");
  app.render();
  assert.equal(app.panel().props.draft.publicLogoUrl, "https://example.com/new-logo.webp");
  aside = app.nodes().find((node) => node.type === "aside");
  app.panel().props.onSave();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.saved[0].publicLogoUrl, "https://example.com/new-logo.webp");
});


test("plan headings distinguish PRO with lightning and Unlimited with a star", () => {
  const app = interactiveProfile();
  app.render();
  const cards = app.nodes().filter((node) => node.type?.name === "PlanCard");
  assert.equal(cards.length, 3);
  const [free, pro, unlimited] = cards.map((card) => app.nodes(card.type(card.props)).find((node) => node.type === "h3"));
  assert.equal(free.props.children[0], null);
  assert.equal(pro.props.children[0].type, components["react-icons/fi"].FiZap);
  assert.equal(pro.props.children[1], messages.profile.proPlan);
  assert.equal(unlimited.props.children[0].type, components["react-icons/fi"].FiStar);
  assert.equal(unlimited.props.children[1], messages.profile.unlimitedPlan);
});


test("public profile preview renders the saved description formatting", () => {
  const html = render(false, { ...profile, publicDescription: "**Welcome**\n- __Arrive early__" });
  assert.match(html, /class="space-y-1 break-words text-left w-full text-sm leading-6 text-muted"/);
  assert.match(html, /<strong>Welcome<\/strong>/);
  assert.match(html, /<li><span class="underline">Arrive early<\/span><\/li>/);
});


test("business profile fields expose matching limits and visible character counters", () => {
  const app = interactiveProfile();
  app.render();
  const tree = app.panel().type(app.panel().props);
  const nodes = app.nodes(tree);
  for (const [label, limit] of [[messages.profile.address, 100], [messages.profile.publicDescription, 333], [messages.profile.publicOpeningHours, 200]]) {
    const field = nodes.find((node) => node.props?.label === label);
    assert.equal(field.props.maxLength, limit);
    assert.equal(field.props.helperText, `0/${limit}`);
  }
});

test("overlong legacy descriptions remain editable but cannot be saved", async () => {
  const app = interactiveProfile();
  app.render();
  app.panel().props.onChange({ ...app.panel().props.draft, publicDescription: "x".repeat(334) });
  app.render();
  const panel = app.panel();
  const nodes = app.nodes(panel.type(panel.props));
  assert.ok(nodes.some((node) => node.props?.role === "alert"));
  assert.ok(nodes.some((node) => node.props?.disabled === true && node.props.children === messages.actions.save));
  await panel.props.onSave();
  assert.equal(app.saved.length, 0);
});


test("previews the three plans and keeps Unlimited unavailable without changing the current tier", () => {
  for (const tier of ["free", "pro"]) {
    const html = render(false, { ...profile, subscriptionTier: tier, subscriptionAccessSource: tier === "pro" ? "paid" : "free" });
    const cards = getPlanCards(html);
    assert.equal(cards.length, 3);
    assert.match(cards[1][2], /150 turnos/);
    assert.match(cards[1][2], /3 integrantes/);
    assert.match(cards[1][2], /10 servicios/);
    assert.match(cards[2][0], /disabled=""/);
    assert.match(cards[2][2], /INFINITY/);
    assert.match(cards[2][2], /55\.000/);
    assert.match(cards[2][2], /Próximamente/);
    assert.doesNotMatch(cards[2][2], /Plan actual/);
    assert.match(html, /Tu suscripción y sus límites actuales no cambian/);
  }
});

test("Unlimited has no checkout handler and the existing PRO checkout retains its current offer", () => {
  const app = interactiveProfile();
  app.render();
  const unlimited = app.nodes().find((node) => node.props?.title === messages.profile.unlimitedPlan);
  assert.ok(unlimited);
  assert.equal(unlimited.props.onClick, undefined);
  assert.equal(unlimited.props.disabledLabel, messages.profile.unlimitedComingSoon);
  assert.equal(app.checkoutCalls(), 0);
  app.button(messages.upgrade.action).props.onClick();
  app.render();
  assert.ok(app.nodes().some((node) => node.props?.children === messages.profile.proPlanFeatures[0]));
  assert.ok(app.nodes().some((node) => node.type === "h3" && Array.isArray(node.props.children) && node.props.children.includes(messages.profile.proPlanPrice)));
});


test("plan comparison aligns staff, services and appointments and uses stars for every Unlimited benefit", () => {
  const app = interactiveProfile();
  app.render();
  const cards = app.nodes().filter((node) => node.type?.name === "PlanCard");
  assert.deepEqual(cards.map((card) => card.props.features.slice(0, 3)), [
    ["Hasta 1 integrante del personal", "Hasta 2 servicios visibles", "Hasta 15 turnos por mes"],
    ["Hasta 3 integrantes del personal", "Hasta 10 servicios activos", "Hasta 150 turnos por mes"],
    ["Personal ilimitado", "Servicios activos ilimitados", "Turnos ilimitados"]
  ]);
  for (const card of cards) {
    const tree = card.type(card.props);
    assert.match(tree.props.className, /xl:grid-rows-subgrid/);
    const list = app.nodes(tree).find((node) => node.type === "ul");
    assert.match(list.props.className, /xl:grid-rows-subgrid/);
    if (card.props.title === messages.profile.unlimitedPlan) {
      const icons = app.nodes(list).filter((node) => node.type === components["react-icons/fi"].FiStar);
      assert.equal(icons.length, card.props.features.length);
    }
  }
});


test("release flag enables the Unlimited confirmation while keeping the selected tier explicit", async () => {
  const previous = process.env.NEXT_PUBLIC_SUBSCRIPTION_PLANS_V2_ENABLED;
  try {
    process.env.NEXT_PUBLIC_SUBSCRIPTION_PLANS_V2_ENABLED = "true";
    const app = interactiveProfile();
    app.render();
    const card = app.nodes().find((node) => node.props?.title === messages.profile.unlimitedPlan);
    assert.equal(card.props.disabledLabel, undefined);
    card.props.onClick();
    app.render();
    assert.ok(app.nodes().some((node) => node.props?.children === messages.profile.unlimitedSubscribeTitle));
    assert.equal(app.checkoutCalls(), 0);
    app.button(messages.profile.subscribeAction).props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.checkoutCalls(), 1);
    const html = render(false, { ...profile, subscriptionTier: "unlimited" });
    assert.match(html, /aria-label="Plan actual: INFINITY/);
    assert.match(getPlanCards(html)[2][2], /Plan actual/);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUBSCRIPTION_PLANS_V2_ENABLED; else process.env.NEXT_PUBLIC_SUBSCRIPTION_PLANS_V2_ENABLED = previous;
  }
});


test("manual access explains that there is no provider subscription to cancel", () => {
  const app = interactiveProfile({ tier: "unlimited", accessSource: "manual" });
  app.render();
  const free = app.nodes().find((node) => node.props?.title === messages.profile.freePlan);
  free.props.onClick();
  app.render();
  assert.ok(app.nodes().some((node) => node.props?.children === messages.profile.manualPlanTitle));
  assert.equal(app.button(messages.profile.unsubscribeAction), undefined);
});
