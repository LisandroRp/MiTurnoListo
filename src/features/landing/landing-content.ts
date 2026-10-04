type LandingPlan = {
  name: string;
  price: string;
  description: string;
  perks: readonly string[];
  highlighted?: boolean;
};

export const landingPlans: readonly LandingPlan[] = [
  {
    name: "Gratis",
    price: "$0",
    description: "Para empezar a ordenar tus primeros turnos.",
    perks: ["Hasta 2 integrantes del personal", "5 servicios visibles", "15 turnos por mes"]
  },
  {
    name: "Premium",
    price: "$25.000",
    description: "Para negocios que viven de la agenda y necesitan orden diario.",
    perks: ["Turnos ilimitados", "Personal y servicios ilimitados", "Estadísticas y pagos online"],
    highlighted: true
  }
] as const;

export const landingCtaPrimary = "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover";
export const landingCtaSecondary = "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-subtle bg-surface px-4 text-sm font-semibold text-primary transition-colors hover:bg-surface-strong";
export const landingCtaLarge = "h-12 px-5 text-base";
export const landingCardHover = "transition-all duration-200 hover:-translate-y-1 hover:shadow-lg";

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.miturnolisto.com").replace(/\/+$/, "");
}
