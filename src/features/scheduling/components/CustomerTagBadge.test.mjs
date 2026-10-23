import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { messages } from "../i18n/messages.ts";

const require = createRequire(import.meta.url);
const url = new URL("./CustomerTagBadge.tsx", import.meta.url);
const loaded = new Module(url.pathname);
loaded.filename = url.pathname;
let popoverContent;
const modules = {
  "@/components/ui/Badge": { Badge: ({ tone, className, children }) => createElement("span", { "data-tone": tone, className }, children) },
  "@/components/ui/FloatingInfoPopover": { FloatingInfoPopover: ({ ariaLabel, content, children }) => {
    popoverContent = content;
    return createElement("button", { "aria-label": ariaLabel }, children);
  } }
};
loaded.require = (name) => modules[name] ?? require(name);
loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, url.pathname);

test("the information control keeps the legend hidden and uses the exact same badges as customer rows", () => {
  const { CustomerTagBadge, CustomerTagInfo } = loaded.exports;
  const html = renderToStaticMarkup(createElement(CustomerTagInfo, { messages: messages.es }));
  assert.ok(html.includes(messages.es.customers.tagRulesTitle));
  assert.doesNotMatch(html, /<li\b|45 días|11 a 20/);
  const legend = renderToStaticMarkup(popoverContent);
  assert.equal((legend.match(/<li /g) ?? []).length, 5);
  for (const tag of ["new", "active", "frequent", "vip", "atRisk"]) {
    const badge = renderToStaticMarkup(createElement(CustomerTagBadge, { tag, messages: messages.es }));
    assert.ok(legend.includes(badge));
    assert.ok(legend.includes(messages.es.customers.tagDescriptions[tag]));
  }
  assert.doesNotMatch(legend, /prioridad/);
  const source = readFileSync(new URL("./CustomersView.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/<CustomerTagBadge tag=/g) ?? []).length, 2);
  assert.doesNotMatch(source, /CustomerTagInfo/);
  const filters = readFileSync(new URL("./CustomerFilters.tsx", import.meta.url), "utf8");
  assert.equal((filters.match(/<CustomerTagInfo messages=/g) ?? []).length, 1);
});
