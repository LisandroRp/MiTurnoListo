import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const url = new URL("./ImageUploadField.tsx", import.meta.url);
const loaded = new Module(url.pathname);
loaded.filename = url.pathname;
const modules = {
  "@/components/ui/Button": { Button: ({ children }) => createElement("button", null, children) },
  "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
};
loaded.require = (name) => modules[name] ?? require(name);
loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText, url.pathname);

test("stacked image upload keeps preview and controls vertical in narrow desktop columns", () => {
  const props = { label: "Logo", value: "https://example.com/logo.webp", chooseLabel: "Choose", replaceLabel: "Replace", removeLabel: "Remove", requirementsLabel: "Logo", onChange: () => {}, onError: () => {} };
  const stacked = renderToStaticMarkup(createElement(loaded.exports.ImageUploadField, { ...props, layout: "stacked" }));
  assert.doesNotMatch(stacked, /lg:flex-row|lg:w-40/);
  assert.match(stacked, /role="img" aria-label="Logo"/);
  assert.match(stacked, />Replace</);
  assert.match(stacked, />Remove</);
  const responsive = renderToStaticMarkup(createElement(loaded.exports.ImageUploadField, props));
  assert.match(responsive, /lg:flex-row/);
  assert.match(responsive, /lg:w-40/);
});
