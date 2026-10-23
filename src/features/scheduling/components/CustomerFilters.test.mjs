import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { messages } from "../i18n/messages.ts";

const require = createRequire(import.meta.url);
const url = new URL("./CustomerFilters.tsx", import.meta.url);
const loaded = new Module(url.pathname);
loaded.filename = url.pathname;
const fields = {
  "@/features/scheduling/components/CustomerTagBadge": { CustomerTagInfo: () => createElement("button", { "aria-label": "Tag information" }) },
  "@/components/ui/Button": { Button: ({ children }) => createElement("button", null, children) },
  "@/components/ui/SelectField": { SelectField: () => null },
  "@/components/ui/TextField": { TextField: () => null }
};
loaded.require = (name) => fields[name] ?? require(name);
loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, url.pathname);

for (const locale of ["es", "en"]) {
  test(`customer filters keep explanations hidden behind the information control in ${locale}`, () => {
    const copy = messages[locale];
    const html = renderToStaticMarkup(createElement(loaded.exports.CustomerFilters, { messages: copy, tag: "frequent", sort: "mostBookings" }));
    assert.match(html, /aria-label="Tag information"/);
    assert.doesNotMatch(html, /<details|<li>/);
    for (const text of Object.values(copy.customers.tagDescriptions)) assert.ok(!html.includes(text));
  });
}
