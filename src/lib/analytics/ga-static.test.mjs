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
  assert.equal(pageViews.includes('trackGooglePageView(url)'), true);
});

test("Meta Pixel uses the public environment variable and client-side page views", () => {
  const rootLayout = readProjectFile("src/app/layout.tsx");
  const metaPixel = readProjectFile("src/components/composed/MetaPixel.tsx");
  const pageViews = readProjectFile("src/components/composed/MetaPixelPageViews.tsx");
  const metaHelper = readProjectFile("src/lib/analytics/meta.ts");

  assert.equal(rootLayout.includes("<MetaPixel />"), true);
  assert.equal(metaPixel.includes("process.env.NEXT_PUBLIC_META_PIXEL_ID"), true);
  assert.equal(metaPixel.includes("1086712663988091"), false);
  assert.equal(metaPixel.includes("connect.facebook.net/en_US/fbevents.js"), true);
  assert.equal(pageViews.includes('trackMetaEvent("PageView")'), true);
  assert.equal(metaHelper.includes("trackMetaEvent"), true);
});

test("marketing CTA analytics are delegated through typed tracking", () => {
  const marketingTracker = readProjectFile("src/components/composed/MarketingEventTracker.tsx");
  const verticalLanding = readProjectFile("src/features/landing/components/VerticalLanding.tsx");
  const publicLanding = readProjectFile("src/features/landing/components/PublicLanding.tsx");

  assert.equal(marketingTracker.includes('trackGoogleEvent("marketing_cta_click"'), true);
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

  assert.equal(authProvider.includes('trackGoogleEvent("sign_up"'), true);
  assert.equal(authProvider.includes('method: "email"'), true);
  assert.equal(authProvider.includes('trackMetaEvent("CompleteRegistration"'), true);
  assert.equal(authProvider.includes('trackGoogleEvent("business_created"'), true);
  assert.equal(authProvider.includes('trackMetaEvent("BusinessCreated"'), true);
  assert.equal(bootstrapRoute.includes("businessCreated"), true);
  assert.equal(schedulingProvider.includes('trackGoogleEvent("service_created"'), true);
  assert.equal(schedulingProvider.includes('trackMetaEvent("ServiceCreated"'), true);
  assert.equal(schedulingProvider.includes('trackGoogleEvent("staff_created"'), true);
  assert.equal(schedulingProvider.includes('trackMetaEvent("StaffCreated"'), true);
  assert.equal(schedulingProvider.includes('trackGoogleEvent("premium_started"'), true);
  assert.equal(schedulingProvider.includes('trackMetaEvent("InitiateCheckout"'), true);
  assert.equal(schedulingProvider.includes('trackMetaEventOnce("Purchase"'), true);
  assert.equal(schedulingProvider.includes('trackGoogleEvent("purchase"'), true);
  assert.equal(schedulingProvider.includes("transaction_id: purchase.paymentId"), true);
  assert.equal(schedulingProvider.includes("trackedPurchasePaymentIds"), true);
  assert.equal(schedulingProvider.includes("payment_id: purchase.paymentId"), true);
  assert.equal(schedulingProvider.includes("value: purchase.amount"), true);
});

test("booking page readiness is not emitted from public customer visits", () => {
  const bookingFlow = readProjectFile("src/features/booking-flow/components/BookingFlow/index.tsx");

  assert.equal(bookingFlow.includes("booking_page_ready"), false);
});
