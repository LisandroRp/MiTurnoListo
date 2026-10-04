import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const projectRoot = resolve(import.meta.dirname, "../../../..");

test("profile snapshot does not load payment settings", () => {
  const schedulingEndpoint = readFileSync(resolve(projectRoot, "src/lib/networking/endpoints/scheduling.ts"), "utf8");

  assert.equal(schedulingEndpoint.includes("profile: {}"), true);
  assert.equal(schedulingEndpoint.includes("profile: {\n      includePaymentSettings: true\n    }"), false);
});

test("profile snapshot does not load referral summary", () => {
  const schedulingEndpoint = readFileSync(resolve(projectRoot, "src/lib/networking/endpoints/scheduling.ts"), "utf8");
  const profilePage = readFileSync(resolve(projectRoot, "src/app/(dashboard)/perfil/page.tsx"), "utf8");

  assert.equal(schedulingEndpoint.includes('return scope === "referrals";'), true);
  assert.equal(profilePage.includes("getReferralSummary"), true);
  assert.equal(profilePage.includes("isReferralSummaryLoading"), true);
});


test("payment method screens still load payment settings", () => {
  const schedulingEndpoint = readFileSync(resolve(projectRoot, "src/lib/networking/endpoints/scheduling.ts"), "utf8");

  assert.equal(schedulingEndpoint.includes("paymentMethods: {\n      includePaymentSettings: true\n    }"), true);
  assert.equal(schedulingEndpoint.includes("services: {\n      includeAppointments: true"), true);
  assert.equal(schedulingEndpoint.includes("includePaymentSettings: true,\n      includeServiceAddons: true"), true);
});

test("profile hydration does not wait for super admin status", () => {
  const schedulingProvider = readFileSync(resolve(projectRoot, "src/features/scheduling/components/SchedulingProvider.tsx"), "utf8");
  const profilePage = readFileSync(resolve(projectRoot, "src/app/(dashboard)/perfil/page.tsx"), "utf8");

  assert.equal(schedulingProvider.includes("getSuperAdminStatus"), false);
  assert.equal(profilePage.includes("getSuperAdminStatus"), true);
  assert.equal(profilePage.includes("setIsSuperAdmin"), true);
});
