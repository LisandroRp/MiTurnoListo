import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const fileUrl = new URL("./ProfileSuperAdminPanel.tsx", import.meta.url);
const source = readFileSync(fileUrl, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  },
  fileName: fileUrl.pathname
}).outputText;
const componentModule = new Module(fileUrl.pathname);
const popoverDetails = [];
const passthrough = (tag) => {
  function Passthrough({ children }) {
    return createElement(tag, null, children);
  }

  return Passthrough;
};
function InfoPopover({ ariaLabel, children, content }) {
  popoverDetails.push(content.props.children);

  return createElement("button", { "aria-label": ariaLabel, type: "button" }, children);
}
const components = {
  "@/components/ui/Badge": { Badge: passthrough("span") },
  "@/components/ui/Button": { Button: passthrough("button") },
  "@/components/ui/Card": { Card: passthrough("section") },
  "@/components/ui/FloatingInfoPopover": { FloatingInfoPopover: InfoPopover },
  "@/components/ui/SelectField": { SelectField: passthrough("select") },
  "@/components/ui/TextField": { TextField: passthrough("input") },
  "@/features/scheduling/utils/format": { formatCurrency: (value) => `ARS ${value}` },
  "react-icons/fi": {
    FiInfo: passthrough("span"),
    FiRefreshCw: passthrough("span"),
    FiSearch: passthrough("span"),
    FiZap: passthrough("span")
  }
};

componentModule.filename = fileUrl.pathname;
componentModule.require = (specifier) => components[specifier] ?? require(specifier);
componentModule._compile(output, fileUrl.pathname);

const { ProfileSuperAdminPanel } = componentModule.exports;

test("shows each business lifetime payments beside the monthly summary", () => {
  const business = {
    businessId: "business-1",
    businessName: "Example business",
    employeeCount: 0,
    isReferralPro: false,
    monthlyAppointmentCount: 0,
    monthlyPaidSubscriptionCount: 1,
    monthlySubscriptionRevenue: 500,
    ownerCreatedAt: "",
    ownerEmail: "owner@example.com",
    ownerEmailVerified: true,
    ownerLastSignInAt: "",
    ownerProvider: "email",
    plan: "pro",
    providerStatus: "authorized",
    providerSubscriptionId: "subscription-1",
    referralActiveDaysRemaining: 0,
    referralAvailableMonths: 0,
    referralCode: "",
    referralPremiumCount: 0,
    referralRegisteredCount: 0,
    referredByCode: "",
    serviceCount: 0,
    subscriptionTier: "pro",
    totalPaidSubscriptionCount: 2,
    totalSubscriptionRevenue: 1000
  };
  const manualBusiness = {
    ...business,
    businessId: "business-2",
    businessName: "Manual business",
    monthlyPaidSubscriptionCount: 0,
    monthlySubscriptionRevenue: 0,
    plan: "free",
    providerStatus: "manual",
    providerSubscriptionId: "",
    totalPaidSubscriptionCount: 0,
    totalSubscriptionRevenue: 0
  };
  const messages = {
    actions: { refresh: "Refresh" },
    calendar: { appointments: "appointments" },
    nav: { services: "services", personnel: "personnel" },
    profile: {
      superAdminBusinesses: "Businesses",
      superAdminBusiness: "Business",
      superAdminSubscription: "Subscription",
      superAdminManualPlan: "Manual",
      superAdminTotalPaid: "Total paid",
      superAdminMonthly: "Month",
      superAdminTotal: "Total",
      superAdminPaidSubscriptions: "paid subscriptions"
    }
  };
  const html = renderToStaticMarkup(createElement(ProfileSuperAdminPanel, {
    actionBusinessId: "",
    businesses: [business, manualBusiness],
    errorMessage: "",
    hasLoadedBusinesses: true,
    isLoading: false,
    messages,
    onAction: () => {},
    onRefresh: () => {}
  }));
  const table = html.match(/<table\b[^>]*>(.*?)<\/table>/s)?.[1];

  assert.ok(table);
  assert.match(table, /<th[^>]*>Total paid<\/th>/);
  assert.match(table, /<td[^>]*>ARS 1000<\/td>/);
  assert.match(html, /Total paid: <span[^>]*>ARS 1000<\/span>/);
  assert.match(html, /ARS 500/);
  assert.equal(html.match(/aria-label="Subscription: subscription-1"/g)?.length, 2);
  assert.equal(html.match(/aria-label="Subscription: Manual"/g)?.length, 2);
  assert.equal(popoverDetails.filter((detail) => detail === "subscription-1").length, 2);
  assert.equal(popoverDetails.filter((detail) => detail === "Manual").length, 2);
  assert.doesNotMatch(html, />subscription-1</);
  assert.doesNotMatch(html, />Manual</);
});
