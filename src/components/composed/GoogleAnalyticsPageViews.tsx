"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { trackPageView } from "@/lib/analytics/ga";

export function GoogleAnalyticsPageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedUrl = useRef("");

  useEffect(() => {
    const queryString = searchParams.toString();
    const path = queryString ? `${pathname}?${queryString}` : pathname;
    const url = new URL(path, window.location.origin).toString();

    if (lastTrackedUrl.current === url) {
      return;
    }

    lastTrackedUrl.current = url;
    trackPageView(url);
  }, [pathname, searchParams]);

  return null;
}
