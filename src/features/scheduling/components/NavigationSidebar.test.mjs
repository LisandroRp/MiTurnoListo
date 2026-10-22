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
  "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
  "@/components/composed/BrandMark": { BrandMark: () => null },
  "@/components/ui/Button": { Button: ({ children, onClick, "aria-label": label }) => createElement("button", { onClick, "aria-label": label }, children) },
  "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
};
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
  assert.equal(icons.length, items.length - 1);
  for (const icon of icons) assert.match(icon[1], /\btext-brand-strong\b/);
  const groups = [...html.matchAll(/<details([^>]*)>([\s\S]*?)<\/details>/g)];
  assert.equal(groups.length, 3);
  assert.match(groups[0][1], /\bopen=""/);
  assert.doesNotMatch(groups[1][1], /\bopen/);
  assert.doesNotMatch(groups[2][1], /\bopen/);
  for (const group of groups) {
    assert.match(group[2], /<summary/);
    assert.match(group[2], /class="h-4 w-4 shrink-0 text-brand-strong transition-transform/);
    assert.doesNotMatch(group[1], /\bname=/);
  }
});

test("all navigation groups remain independently toggleable in compact and mobile menus", () => {
  for (const layout of [{ isCollapsed: true }, { mode: "mobile", isCollapsed: false }]) {
    const html = renderToStaticMarkup(createElement(loaded.exports.NavigationSidebar, {
      items: [], activeView: "home", messages: {
        nav: { operationsGroup: "Operations", businessGroup: "Business", communicationGroup: "Communication" },
        actions: { logout: "Log out" }
      }, onLogout: () => {}, onToggle: () => {}, ...layout
    }));
    assert.equal((html.match(/<summary/g) ?? []).length, 3);
    assert.equal((html.match(/<details open=""/g) ?? []).length, 1);
    for (const label of ["Operations", "Business", "Communication"]) assert.ok(html.includes(label));
  }
});
