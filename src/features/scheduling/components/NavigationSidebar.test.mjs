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
    messages: { actions: { logout: "Cerrar sesión" }, upgrade: { action: "Pasate a Pro" } },
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
