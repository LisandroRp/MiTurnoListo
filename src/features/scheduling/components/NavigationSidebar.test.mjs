import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const fileUrl = new URL("./NavigationSidebar.tsx", import.meta.url);
const loaded = new Module(fileUrl.pathname);
loaded.filename = fileUrl.pathname;
const modules = {
  "next/image": { default: ({ src, alt }) => createElement("img", { src, alt }) },
  "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
  "@/components/composed/BrandMark": { BrandMark: () => null },
  "@/components/ui/Badge": { Badge: ({ children, className }) => createElement("span", { className: `bg-brand-soft text-brand-strong ${className}` }, children) },
  "@/components/ui/Button": { Button: ({ children, onClick, "aria-label": label }) => createElement("button", { onClick, "aria-label": label }, children) },
  "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
};
const groupUrl = new URL("./NavigationSidebarGroup.tsx", import.meta.url);
const groupModule = new Module(groupUrl.pathname);
groupModule.filename = groupUrl.pathname;
groupModule.require = (name) => modules[name] ?? require(name);
groupModule._compile(ts.transpileModule(readFileSync(groupUrl, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS }
}).outputText, groupUrl.pathname);
modules["@/features/scheduling/components/NavigationSidebarGroup"] = groupModule.exports;
loaded.require = (specifier) => modules[specifier] ?? require(specifier);
loaded._compile(ts.transpileModule(readFileSync(fileUrl, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS }
}).outputText, fileUrl.pathname);

test("upgrade access links to the PRO modal on desktop, mobile and collapsed menus", () => {
  const props = {
    items: [], activeView: "home", isCollapsed: false,
    messages: { nav: {}, actions: { logout: "Cerrar sesión" }, upgrade: { action: "Pasate a PRO" } },
    onLogout: () => {}, onToggle: () => {}
  };
  for (const layout of [{}, { mode: "mobile" }, { isCollapsed: true }]) {
    const html = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, { ...props, ...layout, showProUpgrade: true }));
    assert.match(html, /href="\/perfil\?plan=pro"/);
    assert.match(html, /Pasate a PRO/);
    assert.ok(html.indexOf("Pasate a PRO") < html.indexOf("Cerrar sesión"));
  }
  const proHtml = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, { ...props, showProUpgrade: false }));
  assert.doesNotMatch(proHtml, /plan=pro/);
});

test("navigation groups operational links and keeps Profile in the fixed footer", () => {
  const Icon = ({ className }) => createElement("span", { "data-navigation-icon": true, className });
  const items = ["profile", "paymentMethods", "suggestions", "services", "messages", "calendar", "home", "newBooking", "customers", "personnel", "payments", "statistics", "referrals"].map((id) => ({ id, label: id, href: `/${id}`, icon: Icon }));
  const html = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, {
    items, activeView: "messages", isCollapsed: false,
    messages: { nav: { operationsGroup: "Operations", businessGroup: "Business", communicationGroup: "Communication" }, actions: { logout: "Log out" } },
    onLogout: () => {}, onToggle: () => {}
  }));
  assert.doesNotMatch(html, /Operations/);
  assert.match(html, /Business/);
  assert.match(html, /Communication/);
  assert.ok(html.indexOf('href="/home"') < html.indexOf('href="/calendar"'));
  assert.ok(html.indexOf('href="/services"') < html.indexOf('href="/messages"'));
  assert.ok(html.indexOf('href="/profile"') > html.indexOf("</nav>"));
  assert.match(html, /href="\/paymentMethods"/);
  assert.match(html, /href="\/messages"[^>]*aria-current="page"/);
  const icons = [...html.matchAll(/<span data-navigation-icon="true" class="([^"]*)"/g)];
  assert.equal(icons.length, items.length - 1);
  assert.equal(icons.filter((icon) => icon[1].includes("text-brand-strong")).length, icons.length);
  for (const icon of icons) assert.match(icon[1], /text-base/);
  const states = [...html.matchAll(/<button[^>]*aria-expanded="(true|false)"/g)].map((match) => match[1]);
  assert.deepEqual(states, ["false", "true"]);
  assert.equal((html.match(/transition-\[grid-template-rows,opacity\]/g) ?? []).length, 2);
  assert.equal((html.match(/inert=""/g) ?? []).length, 1);
});

test("all navigation groups remain independently toggleable in compact and mobile menus", () => {
  for (const layout of [{ isCollapsed: true }, { mode: "mobile", isCollapsed: false }]) {
    const html = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, {
      items: [], activeView: "home", messages: {
        nav: { operationsGroup: "Operations", businessGroup: "Business", communicationGroup: "Communication" },
        actions: { logout: "Log out" }
      }, onLogout: () => {}, onToggle: () => {}, ...layout
    }));
    assert.equal((html.match(/aria-expanded=/g) ?? []).length, 2);
    assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 0);
    for (const label of ["Business", "Communication"]) assert.ok(html.includes(label));
  }
});

test("account footer displays the business identity, a circular logo and a separate icon-only logout", () => {
  const props = {
    items: [], activeView: "profile", isCollapsed: false,
    messages: { nav: { profile: "Profile" }, actions: { logout: "Log out" } },
    account: { businessName: "Studio", email: "owner@example.com", publicLogoUrl: "https://example.com/logo.png" },
    onLogout: () => {}, onToggle: () => {}
  };
  const html = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, props));
  const footer = html.slice(html.indexOf("</nav>"));
  assert.match(footer, /href="\/perfil"[^>]*aria-current="page"/);
  assert.match(footer, /rounded-full/);
  assert.match(footer, /src="https:\/\/example.com\/logo.png"/);
  assert.match(footer, /line-clamp-2 min-w-0 break-words text-xs font-semibold leading-4 text-primary">Studio/);
  assert.match(footer, /truncate text-xs text-muted">owner@example.com/);
  assert.match(footer, /<button aria-label="Log out"><\/button>/);
  const withoutName = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, { ...props, account: { ...props.account, businessName: "", publicLogoUrl: "" } }));
  assert.doesNotMatch(withoutName, /<img/);
  assert.match(withoutName, /owner@example.com/);
  const compact = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, { ...props, isCollapsed: true }));
  assert.doesNotMatch(compact, />Studio<|>owner@example.com</);
  assert.match(compact, /aria-label="Profile · Studio · owner@example.com"/);
});

test("daily links stay outside collapsible groups and the booking action remains prominent in every layout", () => {
  const Icon = () => null;
  const items = ["home", "calendar", "customers", "newBooking", "services", "messages"].map((id) => ({ id, label: id, href: `/${id}`, icon: Icon }));
  for (const layout of [{ isCollapsed: false }, { isCollapsed: true }, { isCollapsed: false, mode: "mobile" }]) {
    const html = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, {
      items, activeView: "calendar", messages: { nav: { businessGroup: "Business", communicationGroup: "Communication" }, actions: { logout: "Log out" } },
      onLogout: () => {}, onToggle: () => {}, ...layout
    }));
    const booking = html.indexOf('href="/newBooking"');
    assert.ok(booking < html.indexOf('href="/home"'));
    const firstGroup = html.indexOf('aria-expanded="false"');
    for (const id of ["home", "calendar", "customers"]) assert.ok(html.indexOf(`href="/${id}"`) < firstGroup);
    assert.match(html, /href="\/newBooking"[^>]*class="[^"]*border-brand\/20 bg-brand-soft/);
    assert.match(html, /href="\/calendar"[^>]*aria-current="page"/);
    assert.equal((html.match(/aria-expanded=/g) ?? []).length, 2);
  }
});


test("payment methods belongs to Business, opens its group and does not select Profile", () => {
  const Icon = () => null;
  const items = ["profile", "paymentMethods", "services"].map((id) => ({ id, label: id, href: id === "paymentMethods" ? "/metodos-de-pago" : `/${id}`, icon: Icon }));
  for (const layout of [{}, { mode: "mobile" }, { isCollapsed: true }]) {
    const html = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, {
      items, activeView: "paymentMethods", isCollapsed: false,
      messages: { nav: { businessGroup: "Business", communicationGroup: "Communication", profile: "Profile" }, actions: { logout: "Log out" } },
      onLogout: () => {}, onToggle: () => {}, ...layout
    }));
    assert.match(html, /aria-expanded="true"/);
    assert.match(html, /href="\/metodos-de-pago"[^>]*aria-current="page"/);
    assert.ok(html.indexOf('href="/metodos-de-pago"') < html.indexOf("</nav>"));
    assert.doesNotMatch(html.slice(html.indexOf("</nav>")), /aria-current="page"/);
  }
});


test("account footer has no plan badge for either tier", () => {
  for (const subscriptionTier of ["pro", "free"]) {
    const html = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, {
      items: [], activeView: "profile", isCollapsed: false,
      messages: { nav: { profile: "Profile" }, actions: { logout: "Log out" } },
      account: { businessName: "Studio", email: "owner@example.com", publicLogoUrl: "", subscriptionTier },
      onLogout: () => {}, onToggle: () => {}
    }));
    const footer = html.slice(html.indexOf("</nav>"));
    assert.match(footer, /aria-label="Profile · Studio · owner@example.com"/);
    assert.match(footer, />Studio</);
    assert.doesNotMatch(footer, /PRO|!bg-brand/);
  }
});
