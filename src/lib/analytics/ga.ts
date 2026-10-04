"use client";

export type AnalyticsEventParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    __miturnolistoGaConfigured?: boolean;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function getGoogleAnalyticsMeasurementId() {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
}

export function isGoogleAnalyticsEnabled() {
  return Boolean(getGoogleAnalyticsMeasurementId());
}

export function trackEvent(name: string, params: AnalyticsEventParams = {}) {
  if (!ensureGoogleAnalytics() || !name.trim()) {
    return;
  }

  window.gtag?.("event", name, cleanEventParams(params));
}

export function trackPageView(url: string) {
  if (!ensureGoogleAnalytics()) {
    return;
  }

  window.gtag?.("event", "page_view", {
    page_location: url
  });
}

function ensureGoogleAnalytics() {
  const measurementId = getGoogleAnalyticsMeasurementId();

  if (typeof window === "undefined" || !measurementId) {
    return false;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  if (!window.__miturnolistoGaConfigured) {
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      send_page_view: false
    });
    window.__miturnolistoGaConfigured = true;
  }

  return true;
}

function cleanEventParams(params: AnalyticsEventParams) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  );
}
