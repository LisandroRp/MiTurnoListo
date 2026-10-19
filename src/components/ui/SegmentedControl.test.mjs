import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const fileUrl = new URL("./SegmentedControl.tsx", import.meta.url);
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

const { SegmentedControl } = componentModule.exports;

test("segmented control identifies the selected unit accessibly", () => {
  const html = renderToStaticMarkup(createElement(SegmentedControl, {
    label: "Anticipación para cancelar",
    onChange: () => {},
    options: [
      { value: "days", label: "Días" },
      { value: "hours", label: "Horas" }
    ],
    value: "hours"
  }));

  assert.match(html, /role="group" aria-label="Anticipación para cancelar"/);
  assert.match(html, /aria-pressed="false"[^>]*>Días<\/button>/);
  assert.match(html, /aria-pressed="true"[^>]*>Horas<\/button>/);
});
