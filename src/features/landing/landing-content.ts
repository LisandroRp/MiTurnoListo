type LandingPlan = {
  id: "free" | "pro" | "unlimited";
  name: string;
  price: string;
  description: string;
  perks: readonly string[];
  highlighted?: boolean;
};

export const landingPlans: readonly LandingPlan[] = [
  {
    id: "free",
    name: "FREE",
    price: "$0",
    description: "Para empezar a ordenar tus primeros turnos.",
    perks: ["Hasta 1 integrante visible del personal", "Hasta 2 servicios visibles", "Hasta 15 turnos por mes", "Calendario y reservas manuales", "Estadísticas y pagos avanzados bloqueados"]
  },
  {
    id: "pro",
    name: "PRO",
    price: "$25.000",
    description: "Para empezar a automatizar la agenda de tu negocio.",
    perks: ["Hasta 3 integrantes visibles del personal", "Hasta 10 servicios visibles", "Hasta 150 turnos por mes", "Reservas por link y QR", "Pagos online y estadísticas básicas"],
    highlighted: true
  },
  {
    id: "unlimited",
    name: "INFINITY",
    price: "$55.000",
    description: "Para equipos y agendas que necesitan crecer sin límites.",
    perks: ["Personal ilimitado", "Servicios activos ilimitados", "Turnos ilimitados", "Reservas por link y QR", "Pagos online, estadísticas completas y avanzadas"]
  }
] as const;

export const landingCtaPrimary = "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover";
export const landingCtaSecondary = "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-subtle bg-surface px-4 text-sm font-semibold text-primary transition-colors hover:bg-surface-strong";
export const landingCtaLarge = "h-12 px-5 text-base";
export const landingCardHover = "transition-all duration-200 hover:-translate-y-1 hover:shadow-lg";

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.miturnolisto.com").replace(/\/+$/, "");
}
