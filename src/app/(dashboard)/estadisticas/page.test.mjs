import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const url = new URL("./page.tsx", import.meta.url);
const code = ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

test("statistics routing forwards the actual Free, Pro or Infinity tier into feature access control", () => {
  for (const tier of ["free", "pro", "unlimited"]) {
    const loaded = new Module(url.pathname);
    loaded.require = (name) => name.endsWith("/SchedulingProvider") ? { useScheduling: () => ({ profile: { subscriptionTier: tier } }) }
      : name.endsWith("/StatisticsView") ? { StatisticsView: "StatisticsView" } : require(name);
    loaded._compile(code, url.pathname);
    assert.equal(loaded.exports.default().props.subscriptionTier, tier);
  }
});
