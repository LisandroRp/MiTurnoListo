import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const projectRoot = resolve(import.meta.dirname, "../../..");
const disallowedMeasurementId = `G-${"3CQEM5BR8P"}`;

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

test("Google Analytics uses the public environment variable without duplicating automatic page views", () => {
  const googleAnalytics = readProjectFile("src/components/composed/GoogleAnalytics.tsx");
  const pageViews = readProjectFile("src/components/composed/GoogleAnalyticsPageViews.tsx");

  assert.equal(googleAnalytics.includes("process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID"), true);
  assert.equal(googleAnalytics.includes(disallowedMeasurementId), false);
  assert.equal(googleAnalytics.includes("send_page_view: false"), true);
  assert.equal(pageViews.includes("usePathname"), true);
  assert.equal(pageViews.includes("useSearchParams"), true);
  assert.equal(pageViews.includes('trackPageView(url)'), true);
});

test("marketing CTA analytics are delegated through typed tracking", () => {
  const marketingTracker = readProjectFile("src/components/composed/MarketingEventTracker.tsx");
  const verticalLanding = readProjectFile("src/features/landing/components/VerticalLanding.tsx");
  const publicLanding = readProjectFile("src/features/landing/components/PublicLanding.tsx");

  assert.equal(marketingTracker.includes('trackEvent("marketing_cta_click"'), true);
  assert.equal(marketingTracker.includes("location"), true);
  assert.equal(marketingTracker.includes("vertical"), true);
  assert.equal(verticalLanding.includes('cta: "hero_signup" | "pricing_signup" | "bottom_signup"'), true);
  assert.equal(verticalLanding.includes("data-cta={cta}"), true);
  assert.equal(publicLanding.includes('data-vertical="home"'), true);
  assert.equal(publicLanding.includes('data-cta="hero_signup"'), true);
});

test("funnel events fire only after confirmed product actions", () => {
  const authProvider = readProjectFile("src/features/auth/components/AuthProvider.tsx");
  const schedulingProvider = readProjectFile("src/features/scheduling/components/SchedulingProvider.tsx");
  const bootstrapRoute = readProjectFile("src/app/api/auth/bootstrap/route.ts");

  assert.equal(authProvider.includes('trackEvent("sign_up"'), true);
  assert.equal(authProvider.includes('method: "email"'), true);
  assert.equal(authProvider.includes('trackEvent("business_created"'), true);
  assert.equal(bootstrapRoute.includes("businessCreated"), true);
  assert.equal(schedulingProvider.includes('trackEvent("service_created"'), true);
  assert.equal(schedulingProvider.includes('trackEvent("staff_created"'), true);
  assert.equal(schedulingProvider.includes('trackEvent("premium_started"'), true);
});

test("booking page readiness is not emitted from public customer visits", () => {
  const bookingFlow = readProjectFile("src/features/booking-flow/components/BookingFlow/index.tsx");

  assert.equal(bookingFlow.includes("booking_page_ready"), false);
});
