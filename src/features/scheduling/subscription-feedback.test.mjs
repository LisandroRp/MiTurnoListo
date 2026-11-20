import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import test from "node:test";
import ts from "typescript";

function load(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  const loaded = new Module(url.pathname);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, url.pathname);
  return loaded.exports;
}

const { messages } = load("./i18n/messages.ts");
const { getSubscriptionActivationFeedback } = load("./subscription-feedback.ts");

test("activation feedback names the confirmed plan in both languages and all entry points", () => {
  for (const locale of ["es", "en"]) {
    for (const [tier, name] of [["pro", "PRO"], ["unlimited", "INFINITY"]]) {
      const feedback = getSubscriptionActivationFeedback(messages[locale], tier);
      assert.ok(feedback.title.includes(name));
      assert.ok(feedback.description.includes(name));
      assert.doesNotMatch(JSON.stringify(feedback), /\{plan\}/);
      if (tier === "unlimited") assert.doesNotMatch(JSON.stringify(feedback), /PRO/);
    }
    assert.doesNotMatch(messages[locale].profile.subscriptionPendingDescription, /PRO/);
  }
  for (const path of ["./components/AppShell.tsx", "./components/SchedulingProvider.tsx", "../../app/(dashboard)/perfil/page.tsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /getSubscriptionActivationFeedback\((?:messages|copy), result.subscriptionTier\)/);
  }
});
