import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const fileUrl = new URL("./ProfileReferralRewardCallout.tsx", import.meta.url);
const output = ts.transpileModule(readFileSync(fileUrl, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: fileUrl.pathname
}).outputText;
const componentModule = new Module(fileUrl.pathname);
componentModule.filename = fileUrl.pathname;
componentModule.require = (specifier) => {
  if (specifier === "@/components/ui/Button") {
    return { Button: ({ children }) => createElement("button", null, children) };
  }
  if (specifier === "react-icons/fi") {
    return { FiZap: () => createElement("span", null) };
  }
  return require(specifier);
};
componentModule._compile(output, fileUrl.pathname);

const { ProfileReferralRewardCallout } = componentModule.exports;
const messages = {
  profile: {
    referralProActiveTitle: "Referral PRO active",
    referralProActivePrefix: "You have",
    referralProActiveSuffix: "days remaining",
    referralRewardAvailableTitle: "Referral PRO available",
    referralRewardAvailableSingular: "One reward is ready",
    referralRewardAvailablePlural: "{count} rewards are ready",
    referralRewardActivateAction: "Activate PRO with referrals",
    referralRewardEmptyTitle: "No referral rewards yet",
    referralRewardEmptyDescription: "You have no rewards available yet",
    referralRewardSavedTitle: "You have saved referral rewards",
    referralRewardSavedDescription: "You can activate one when you return to Free",
    referralRewardErrorTitle: "We could not load your referral rewards",
    referralRewardErrorDescription: "Refresh the page to try again",
    superAdminReferralDays: "days"
  }
};

function render(profile, isLoading = false, hasError = false) {
  return renderToStaticMarkup(createElement(ProfileReferralRewardCallout, {
    hasError,
    isLoading,
    messages,
    onActivate: async () => true,
    profile
  }));
}

function profile(subscriptionTier, subscriptionAccessSource, availableRewardCount) {
  return {
    subscriptionTier,
    subscriptionAccessSource,
    referralSummary: { activeDaysRemaining: 12, availableRewardCount }
  };
}

test("shows the referral skeleton independently of the plan label", () => {
  const html = render(profile("free", "free", 2), true);

  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /Activate PRO with referrals/);
});

test("offers one reward activation only while the business is Free", () => {
  const freeHtml = render(profile("free", "free", 2));
  const paidHtml = render(profile("pro", "paid", 2));
  const activeHtml = render(profile("pro", "referral", 1));

  assert.match(freeHtml, /2 rewards are ready/);
  assert.match(freeHtml, /<button[^>]*>Activate PRO with referrals<\/button>/);
  assert.match(paidHtml, /You have saved referral rewards/);
  assert.doesNotMatch(paidHtml, /Activate PRO with referrals/);
  assert.match(activeHtml, /Referral PRO active/);
  assert.doesNotMatch(activeHtml, /Activate PRO with referrals/);
});

test("shows an empty state after loading when there are no referral rewards", () => {
  const html = render(profile("free", "free", 0));

  assert.match(html, /No referral rewards yet/);
  assert.doesNotMatch(html, /animate-pulse/);
  assert.doesNotMatch(html, /Activate PRO with referrals/);
});

test("shows an error state instead of reporting no rewards when the summary fails", () => {
  const html = render(profile("free", "free", 0), false, true);

  assert.match(html, /We could not load your referral rewards/);
  assert.doesNotMatch(html, /No referral rewards yet/);
});


test("all referral states use the same branded border and surface background", () => {
  for (const [currentProfile, loading, failed] of [
    [profile("free", "free", 0), true, false],
    [profile("free", "free", 0), false, true],
    [profile("free", "free", 0), false, false],
    [profile("free", "free", 2), false, false],
    [profile("pro", "paid", 2), false, false],
    [profile("pro", "referral", 1), false, false]
  ]) {
    assert.match(render(currentProfile, loading, failed), /border border-brand bg-surface/);
  }
});
