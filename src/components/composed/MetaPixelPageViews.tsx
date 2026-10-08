"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { trackMetaEvent } from "@/lib/analytics/meta";

export function MetaPixelPageViews() {
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
    trackMetaEvent("PageView");
  }, [pathname, searchParams]);

  return null;
}
