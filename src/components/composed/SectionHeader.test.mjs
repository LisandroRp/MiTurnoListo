import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const fileUrl = new URL("./SectionHeader.tsx", import.meta.url);
const loaded = new Module(fileUrl.pathname);
loaded.filename = fileUrl.pathname;
loaded.require = require;
loaded._compile(ts.transpileModule(readFileSync(fileUrl, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText, fileUrl.pathname);

test("the decorative icon sits beside a shared eyebrow and title column", () => {
  const html = renderToStaticMarkup(createElement(loaded.exports.SectionHeader, {
    title: "Payments", eyebrow: "Business", description: "Manage payments", icon: createElement("i", { "data-icon": "payments" }), actions: createElement("button", null, "New")
  }));
  assert.match(html, /flex items-center gap-3/);
  assert.match(html, /shrink-0/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /<div class="min-w-0"><p[^>]*>Business<\/p><h1[^>]*>Payments<\/h1><\/div>/);
  assert.ok(html.indexOf('data-icon="payments"') < html.indexOf(">Business<"));
  assert.match(html, /Business/);
  assert.match(html, /Manage payments/);
  assert.match(html, /<button>New<\/button>/);
  const noIcon = renderToStaticMarkup(createElement(loaded.exports.SectionHeader, { title: "Title" }));
  assert.doesNotMatch(noIcon, /aria-hidden/);
});

test("all dashboard section headings use the same icon as their drawer item", () => {
  const root = new URL("../../", import.meta.url);
  const files = [
    ["features/scheduling/components/DashboardView.tsx", "home"],
    ["features/scheduling/components/CalendarView.tsx", "calendar"],
    ["features/scheduling/components/PersonnelView/index.tsx", "personnel"],
    ["features/scheduling/components/ServicesView.tsx", "services"],
    ["features/scheduling/components/CustomersView.tsx", "customers"],
    ["features/scheduling/components/PaymentsView.tsx", "payments"],
    ["features/scheduling/components/StatisticsView.tsx", "statistics"],
    ["features/scheduling/components/ProfileView.tsx", "profile"],
    ["features/scheduling/components/SuggestionsView.tsx", "suggestions"],
    ["features/scheduling/components/PaymentMethodsView.tsx", "paymentMethods"],
    ["features/scheduling/components/MessageTemplatesView.tsx", "messages"],
    ["app/(dashboard)/nueva-reserva/page.tsx", "newBooking"],
    ["app/(dashboard)/referidos/page.tsx", "referrals"],
    ["app/(dashboard)/metodos-de-pago/page.tsx", "paymentMethods"]
  ];
  const shell = readFileSync(new URL("features/scheduling/components/AppShell.tsx", root), "utf8");
  for (const [path, view] of files) {
    const icon = shell.match(new RegExp(`id: "${view}"[^\\n]*icon: (\\w+)`))[1];
    const file = ts.createSourceFile(path, readFileSync(new URL(path, root), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let headings = 0;
    function visit(node) {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(file) === "SectionHeader") {
        headings += 1;
        const attribute = node.attributes.properties.find((prop) => prop.name?.getText(file) === "icon");
        assert.ok(attribute, `Missing section icon in ${path}`);
        assert.match(attribute.initializer.getText(file), new RegExp(`<${icon}(?: |/)`), path);
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
    assert.ok(headings > 0, `Missing heading in ${path}`);
  }
});
