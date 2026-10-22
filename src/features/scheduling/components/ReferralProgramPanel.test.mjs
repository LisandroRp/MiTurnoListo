import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const fileUrl = new URL("./ReferralProgramPanel.tsx", import.meta.url);
const output = ts.transpileModule(readFileSync(fileUrl, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: fileUrl.pathname
}).outputText;
const componentModule = new Module(fileUrl.pathname);
componentModule.filename = fileUrl.pathname;
const passthrough = (tag) => {
  function Passthrough({ children }) {
    return createElement(tag, null, children);
  }

  return Passthrough;
};
componentModule.require = (specifier) => {
  if (specifier === "@/components/ui/Badge") return { Badge: passthrough("span") };
  if (specifier === "@/components/ui/Button") return { Button: passthrough("button") };
  if (specifier === "@/components/ui/Card") return { Card: passthrough("section") };
  if (specifier === "react-icons/fi") {
    return { FiCopy: passthrough("span"), FiGift: passthrough("span"), FiShare2: passthrough("span") };
  }
  return require(specifier);
};
componentModule._compile(output, fileUrl.pathname);

const { ReferralProgramPanel } = componentModule.exports;

for (const isProgramActive of [false, true]) {
  test(`renders three separate referral rules when the program is ${isProgramActive ? "active" : "inactive"}`, () => {
    const rules = ["Registration rule", "Payment rule", "Activation rule"];
    const html = renderToStaticMarkup(createElement(ReferralProgramPanel, {
      messages: { profile: { referralsRules: rules } },
      profile: { referralSummary: { isProgramActive, availableDays: 0 } },
      onActivate: async () => true
    }));
    assert.equal((html.match(/<ul\b/g) ?? []).length, 1);
    assert.equal((html.match(/<li\b/g) ?? []).length, 3);
    for (const rule of rules) assert.ok(html.includes(`<li>${rule}</li>`));
  });
}

test("shows remaining referral days even when a paused reward is shorter than a month", () => {
  const html = renderToStaticMarkup(createElement(ReferralProgramPanel, {
    messages: {
      profile: {
        referralsTitle: "Referrals",
        referralsAvailableMetric: "Available days",
        referralsRegisteredMetric: "Registered",
        referralsPremiumMetric: "Premium",
        referralsUsedMetric: "Used months",
        referralsRules: ["Registration rule", "Payment rule", "Activation rule"]
      }
    },
    profile: {
      referralSummary: {
        isProgramActive: true,
        referralCode: "ABC123",
        referralLink: "https://example.com/ref",
        registeredCount: 1,
        premiumReferralCount: 1,
        availableDays: 12,
        availableMonths: 0,
        usedMonths: 0
      }
    },
    onActivate: async () => true
  }));

  assert.match(html, /Available days<\/p><p[^>]*>12<\/p>/);
});
