import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const url = new URL("./CheckboxField.tsx", import.meta.url);
const loaded = new Module(url.pathname);
loaded.require = (name) => name === "@/components/ui/utils" ? { cx: (...values) => values.filter(Boolean).join(" ") } : require(name);
loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
const { CheckboxField } = loaded.exports;

test("plain checkbox keeps its label and interaction without a bordered background", () => {
  let checked = false;
  const props = { label: "Hide price", id: "hide-price", variant: "plain", checked, onChange: (event) => { checked = event.target.checked; } };
  const tree = CheckboxField(props);
  tree.props.children[0].props.onChange({ target: { checked: true } });
  const html = renderToStaticMarkup(createElement(CheckboxField, { ...props, checked }));
  assert.match(html, /for="hide-price"/);
  assert.match(html, /type="checkbox"[^>]*checked=""/);
  assert.match(html, /Hide price/);
  assert.doesNotMatch(html, /border-subtle|bg-input|\bp-3\b/);
  const defaultHtml = renderToStaticMarkup(createElement(CheckboxField, { label: "Default", onChange: () => {} }));
  assert.match(defaultHtml, /border-subtle bg-input p-3/);
});

test("service booking starts with price and its plain control before the six grid cells", () => {
  const source = readFileSync(new URL("../../features/scheduling/components/ServicesView.tsx", import.meta.url), "utf8");
  const section = source.slice(source.indexOf('{currentStep === "booking"'), source.indexOf("<ServiceAddonsEditor"));
  const fields = [...section.matchAll(/label=\{messages.services\.([a-zA-Z]+)\}/g)].map((match) => match[1]);
  assert.deepEqual(fields.filter((field, index) => fields.indexOf(field) === index), ["price", "hidePricePublicly", "deposit", "leadTime", "cancellationLeadTime", "paymentMethod", "durationMinutesLabel", "capacity"]);
  assert.match(section, /<p className="text-xs text-warning">\{messages.services.paymentMethodDisabledHint\}/);
  assert.doesNotMatch(section, /bg-warning|border-warning|order-/);
  assert.match(section, /variant="plain"/);
});
