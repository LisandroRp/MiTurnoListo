"use client";

import type { AnalyticsEventParams } from "@/lib/analytics/ga";

type MetaPixelQueue = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  loaded?: boolean;
  queue?: unknown[];
  version?: string;
};

declare global {
  interface Window {
    __miturnolistoMetaConfigured?: boolean;
    fbq?: MetaPixelQueue;
    _fbq?: MetaPixelQueue;
  }
}

export function getMetaPixelId() {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
}

export function isMetaPixelEnabled() {
  return Boolean(getMetaPixelId());
}

export function trackMetaEvent(name: string, params: AnalyticsEventParams = {}) {
  if (!ensureMetaPixel() || !name.trim()) {
    return;
  }

  window.fbq?.("track", name, cleanEventParams(params));
}

export function trackMetaEventOnce(name: string, eventId: string, params: AnalyticsEventParams = {}) {
  if (!ensureMetaPixel() || !name.trim() || !eventId.trim()) {
    return;
  }

  window.fbq?.("track", name, cleanEventParams(params), {
    eventID: eventId
  });
}

function ensureMetaPixel() {
  const pixelId = getMetaPixelId();

  if (typeof window === "undefined" || !pixelId) {
    return false;
  }

  window.fbq = window.fbq ?? function fbq(...args: unknown[]) {
    window.fbq?.callMethod
      ? window.fbq.callMethod(...args)
      : window.fbq?.queue?.push(args);
  };
  window.fbq.queue = window.fbq.queue ?? [];
  window.fbq.loaded = window.fbq.loaded ?? false;
  window.fbq.version = window.fbq.version ?? "2.0";
  window._fbq = window._fbq ?? window.fbq;

  if (!window.__miturnolistoMetaConfigured) {
    window.fbq("init", pixelId);
    window.__miturnolistoMetaConfigured = true;
  }

  return true;
}

function cleanEventParams(params: AnalyticsEventParams) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  );
}
