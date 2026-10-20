import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const fileUrl = new URL("./Badge.tsx", import.meta.url);
const require = createRequire(import.meta.url);
const output = ts.transpileModule(readFileSync(fileUrl, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const componentModule = new Module(fileUrl.pathname);
componentModule.filename = fileUrl.pathname;
componentModule.require = (specifier) => specifier === "@/components/ui/utils"
  ? { cx: (...classes) => classes.filter(Boolean).join(" ") }
  : require(specifier);
componentModule._compile(output, fileUrl.pathname);

const { Badge } = componentModule.exports;

test("neutral badge uses neutral surface and text tokens", () => {
  const html = renderToStaticMarkup(createElement(Badge, { tone: "neutral" }, "Sin cambios"));

  assert.match(html, /bg-surface-strong/);
  assert.match(html, /text-muted-strong/);
  assert.doesNotMatch(html, /bg-muted(?:\s|\")/);
  assert.doesNotMatch(html, /!text-brand-strong/);
});
