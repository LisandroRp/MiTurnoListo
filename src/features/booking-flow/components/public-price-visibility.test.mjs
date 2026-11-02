import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { messages } from "../../scheduling/i18n/messages.ts";

const require = createRequire(import.meta.url);
const row = ({ label, value }) => createElement("div", null, label, ": ", value);
const modules = {
  "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
  "@/components/ui/Card": { Card: ({ children }) => createElement("section", null, children) },
  "@/components/ui/Badge": { Badge: ({ children }) => createElement("span", null, children) },
  "@/components/ui/SelectField": { SelectField: () => null },
  "@/features/booking-flow/components/BookingFlow/shared/bookingFlowPrimitives": { SummaryRow: row, SidebarItem: row, MetricPill: row },
  "@/features/booking-flow/utils/booking": { formatLongDate: () => "Date" },
  "@/features/booking-flow/utils/catalog": { getProfessionalLabel: () => "Professional" },
  "@/features/scheduling/service-cancellation-policy": { formatCancellationPolicy: () => "Cancellation policy" },
  "@/features/scheduling/utils/format": { formatCurrency: (amount) => `AMOUNT:${amount}` }
};
function load(path, name) {
  const url = new URL(path, import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  return loaded.exports[name];
}
modules["@/components/ui/FormattedText"] = { FormattedText: load("../../../components/ui/FormattedText.tsx", "FormattedText") };
const components = [
  ["./BookingFlow/steps/ServiceStep.tsx", "ServiceStep"],
  ["./BookingFlow/steps/SummaryStep.tsx", "SummaryStep"],
  ["./BookingFlow/layout/BookingSidebar.tsx", "BookingSidebar"],
  ["./BookingFlow/steps/AddonsStep.tsx", "AddonsStep"]
].map(([path, name]) => [name, load(path, name)]);
const addon = { id: "addon", name: "Extra", price: 234, isActive: true };
function render(Component, hidePricePublicly, deposit = 0) {
  return renderToStaticMarkup(createElement(Component, {
    messages: messages.es, locale: "es", service: { name: "Consultation", description: "**Welcome**\n- __Arrive early__", price: 1234, deposit, hidePricePublicly, capacity: 1, customFields: [], addons: [addon] },
    draft: { customer: { fullName: "Customer" }, customFieldResponses: {}, partySize: 1 },
    employees: [], employeeName: "Professional", addons: [addon], selectedAddons: [addon], selectedAddonIds: [], selectedPartySize: 1,
    hidePricePublicly, total: 1468, onToggleAddon: () => {}, onPartySizeChange: () => {}
  }));
}

test("public booking hides prices across service, extras, sidebar and final summary", () => {
  for (const [name, Component] of components) {
    const hidden = render(Component, true);
    assert.doesNotMatch(hidden, /AMOUNT:/, name);
    assert.match(render(Component, false), /AMOUNT:/, name);
    assert.match(render(Component, undefined), /AMOUNT:/, `legacy ${name}`);
  }
});

test("a required deposit remains visible without revealing the service price", () => {
  for (const [name, Component] of components.filter(([name]) => ["ServiceStep", "SummaryStep"].includes(name))) {
    const html = render(Component, true, 100);
    assert.match(html, /AMOUNT:100/, name);
    assert.doesNotMatch(html, /AMOUNT:1234|AMOUNT:1468|AMOUNT:234/, name);
  }
});

test("public visibility is persisted without changing the internal price", () => {
  const source = readFileSync(new URL("../../../app/api/scheduling/mutations/route.ts", import.meta.url), "utf8");
  assert.match(source, /price_amount: service.price,/);
  assert.match(source, /hide_price_publicly: service.hidePricePublicly === true/);
  const editor = readFileSync(new URL("../../scheduling/components/ServicesView.tsx", import.meta.url), "utf8");
  assert.match(editor, /checked=\{draft.hidePricePublicly === true\}/);
  assert.match(editor, /hidePricePublicly: event.target.checked/);
});

test("catalog cards hide prices only for services with the visibility option enabled", () => {
  const payload = { businessName: "Business", services: [{ id: "service", name: "Consultation", description: "Description", price: 1234, durationMinutes: 30, capacity: 1, employeeNames: [], hidePricePublicly: true }] };
  const react = require("react");
  const original = { ...modules };
  try {
    modules.react = { ...react, useEffect: () => {}, useState: (initial) => [typeof initial === "object" ? payload : initial === true ? false : initial, () => {}] };
    modules["next/link"] = { default: ({ children, ...props }) => createElement("a", props, children) };
    modules["@/components/composed/BrandMark"] = { BrandMark: () => null };
    modules["@/features/booking-flow/components/PublicBusinessHeader"] = { PublicBusinessHeader: () => null };
    modules["@/components/ui/TextField"] = { TextField: () => null };
    modules["@/components/ui/SelectField"] = { SelectField: () => null };
    modules["@/components/ui/utils"] = { cx: (...values) => values.filter(Boolean).join(" ") };
    modules["@/features/scheduling/i18n/messages"] = { messages };
    modules["@/features/booking-flow/utils/catalog"] = { getCatalogDescription: (value) => value, getProfessionalLabel: () => "Professional", getServiceTitleOverflowClass: () => "" };
    modules["@/lib/networking/endpoints/public-services"] = {};
    modules["@/lib/networking/response-errors"] = {};
    const Component = load("./PublicServicesCatalog.tsx", "PublicServicesCatalog");
    assert.doesNotMatch(renderToStaticMarkup(createElement(Component, { businessId: "business" })), /AMOUNT:/);
    payload.services[0].hidePricePublicly = false;
    assert.match(renderToStaticMarkup(createElement(Component, { businessId: "business" })), /AMOUNT:1234/);
  } finally {
    for (const key of Object.keys(modules)) delete modules[key];
    Object.assign(modules, original);
  }
});


test("duration fills the service grid width when its price is hidden", () => {
  const Component = components.find(([name]) => name === "ServiceStep")[1];
  const hidden = render(Component, true);
  assert.match(hidden, /<div class="sm:col-span-2"><div>Duración estimada/);
  assert.doesNotMatch(render(Component, false), /sm:col-span-2/);
});


test("booking service description renders bold, underline and bullets", () => {
  const Component = components.find(([name]) => name === "ServiceStep")[1];
  const html = render(Component, true);
  assert.match(html, /<strong>Welcome<\/strong>/);
  assert.match(html, /<li><span class="underline">Arrive early<\/span><\/li>/);
});
