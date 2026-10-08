"use client";

import { useEffect } from "react";

import { trackGoogleEvent } from "@/lib/analytics/ga";

const ctaLocations = new Set(["hero_signup", "how_it_works", "pricing_signup", "bottom_signup"]);
const verticals = new Set(["home", "barberias", "peluquerias", "estetica"]);

export function MarketingEventTracker() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-cta][data-vertical]")
        : null;

      if (!target) {
        return;
      }

      const location = target.dataset.cta ?? "";
      const vertical = target.dataset.vertical ?? "";

      if (!ctaLocations.has(location) || !verticals.has(vertical)) {
        return;
      }

      trackGoogleEvent("marketing_cta_click", {
        location,
        vertical
      });
    }

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  return null;
}
