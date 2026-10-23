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

test("upgrade access links to the Pro modal on desktop, mobile and collapsed menus", () => {
  const props = {
    items: [], activeView: "home", isCollapsed: false,
    messages: { nav: {}, actions: { logout: "Cerrar sesión" }, upgrade: { action: "Pasate a Pro" } },
    onLogout: () => {}, onToggle: () => {}
  };
  for (const layout of [{}, { mode: "mobile" }, { isCollapsed: true }]) {
    const html = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, { ...props, ...layout, showProUpgrade: true }));
    assert.match(html, /href="\/perfil\?plan=pro"/);
    assert.match(html, /Pasate a Pro/);
    assert.ok(html.indexOf("Pasate a Pro") < html.indexOf("Cerrar sesión"));
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
  assert.match(html, /Operations/);
  assert.match(html, /Business/);
  assert.match(html, /Communication/);
  assert.ok(html.indexOf('href="/home"') < html.indexOf('href="/calendar"'));
  assert.ok(html.indexOf('href="/services"') < html.indexOf('href="/messages"'));
  assert.ok(html.indexOf('href="/profile"') > html.indexOf("</nav>"));
  assert.doesNotMatch(html, /href="\/paymentMethods"/);
  assert.match(html, /href="\/messages"[^>]*aria-current="page"/);
  const icons = [...html.matchAll(/<span data-navigation-icon="true" class="([^"]*)"/g)];
  assert.equal(icons.length, items.length - 2);
  for (const icon of icons) assert.match(icon[1], /\btext-brand-strong\b/);
  const states = [...html.matchAll(/<button[^>]*aria-expanded="(true|false)"/g)].map((match) => match[1]);
  assert.deepEqual(states, ["true", "false", "false"]);
  assert.equal((html.match(/transition-\[grid-template-rows,opacity\]/g) ?? []).length, 3);
  assert.equal((html.match(/inert=""/g) ?? []).length, 2);
});

test("all navigation groups remain independently toggleable in compact and mobile menus", () => {
  for (const layout of [{ isCollapsed: true }, { mode: "mobile", isCollapsed: false }]) {
    const html = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, {
      items: [], activeView: "home", messages: {
        nav: { operationsGroup: "Operations", businessGroup: "Business", communicationGroup: "Communication" },
        actions: { logout: "Log out" }
      }, onLogout: () => {}, onToggle: () => {}, ...layout
    }));
    assert.equal((html.match(/aria-expanded=/g) ?? []).length, 3);
    assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 1);
    for (const label of ["Operations", "Business", "Communication"]) assert.ok(html.includes(label));
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
  assert.match(footer, /truncate text-sm font-semibold text-primary">Studio/);
  assert.match(footer, /truncate text-xs text-muted">owner@example.com/);
  assert.match(footer, /<button aria-label="Log out"><\/button>/);
  const withoutName = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, { ...props, account: { ...props.account, businessName: "", publicLogoUrl: "" } }));
  assert.doesNotMatch(withoutName, /<img/);
  assert.match(withoutName, /owner@example.com/);
  const compact = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, { ...props, isCollapsed: true }));
  assert.doesNotMatch(compact, />Studio<|>owner@example.com</);
  assert.match(compact, /aria-label="Profile · Studio · owner@example.com"/);
});
