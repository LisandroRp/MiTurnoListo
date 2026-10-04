import { Suspense } from "react";
import Script from "next/script";

import { GoogleAnalyticsPageViews } from "@/components/composed/GoogleAnalyticsPageViews";

export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

  if (!measurementId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
if (!window.__miturnolistoGaConfigured) {
  gtag('js', new Date());
  gtag('config', ${JSON.stringify(measurementId)}, { send_page_view: false });
  window.__miturnolistoGaConfigured = true;
}
`
        }}
      />
      <Suspense fallback={null}>
        <GoogleAnalyticsPageViews />
      </Suspense>
    </>
  );
}
