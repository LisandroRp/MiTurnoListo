import Link from "next/link";
import { FiArrowRight, FiBarChart2, FiCalendar, FiCheckCircle, FiClock, FiUsers } from "react-icons/fi";

import { BrandMark } from "@/components/composed/BrandMark";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";

const stats = [
  { value: "+38%", label: "mas turnos confirmados" },
  { value: "12 h", label: "ahorradas por semana" },
  { value: "-64%", label: "menos mensajes manuales" }
];

const features = [
  { icon: FiCalendar, title: "Agenda clara", description: "Mira dia, semana y mes sin perder de vista quien atiende cada turno." },
  { icon: FiUsers, title: "Equipo ordenado", description: "Carga personal, disponibilidad y servicios para evitar cruces raros." },
  { icon: FiBarChart2, title: "Datos rapidos", description: "Tenes caja estimada, cancelaciones y actividad diaria en el inicio." },
  { icon: FiClock, title: "Configuracion simple", description: "Servicios con duracion, anticipo, capacidad y horarios disponibles." }
];

const plans = [
  {
    name: "Gratis",
    price: "$0",
    description: "Para probar la app y ordenar los primeros turnos.",
    perks: ["Hasta 2 empleados", "5 servicios activos", "Calendario basico"]
  },
  {
    name: "Premium",
    price: "$25.000",
    description: "Para negocios que viven de la agenda y necesitan orden diario.",
    perks: ["Empleados ilimitados", "Servicios ilimitados", "Metricas, temas y soporte prioritario"],
    highlighted: true
  }
];

const ctaPrimary = "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover";
const ctaSecondary = "inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-subtle bg-surface px-4 text-sm font-semibold text-primary transition-colors hover:bg-surface-strong";
const ctaLarge = "h-12 px-5 text-base";
const landingCardHover = "transition-all duration-200 hover:-translate-y-1 hover:shadow-lg";

export function PublicLanding() {
  return (
    <main className="min-h-screen bg-page text-primary">
      <header className="sticky top-0 z-30 border-b border-subtle bg-sidebar/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="block">
            <BrandMark variant="full" size="md" priority />
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="#planes" className="hidden cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-strong hover:text-primary sm:inline-flex">
              Planes
            </Link>
            <Link href="/login" className={cx(ctaSecondary, "hidden sm:inline-flex")}>Login</Link>
            <Link href="/login" className={ctaPrimary}>
              Probar demo <FiArrowRight />
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div className="flex flex-col justify-center">
          <Badge tone="brand" className="w-fit">Agenda, equipo y servicios en un solo lugar</Badge>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight text-primary sm:text-6xl">
            La app simple para que cualquier negocio venda mas turnos sin vivir en WhatsApp.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
            Pensada para peluquerias, consultorios, estudios, talleres y cualquier equipo que necesite
            ordenar reservas, horarios y personal sin complicarse.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className={cx(ctaPrimary, ctaLarge)}>
              Entrar a la demo <FiArrowRight />
            </Link>
            <Link href="#planes" className={cx(ctaSecondary, ctaLarge)}>Ver planes</Link>
          </div>
        </div>

        <Card className={cx("grid gap-4 bg-sidebar", landingCardHover)}>
          <div className="rounded-lg bg-brand-soft p-5">
            <p className="text-sm font-semibold text-brand-strong">Resumen de hoy</p>
            <p className="mt-3 text-4xl font-bold text-primary">$187.500</p>
            <p className="mt-1 text-sm text-muted">ganancias estimadas antes del cierre</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {stats.map((stat) => (
              <div key={stat.label} className={cx("rounded-lg border border-subtle bg-input p-4", landingCardHover)}>
                <p className="text-2xl font-bold text-primary">{stat.value}</p>
                <p className="mt-1 text-sm text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <Card key={feature.title} className={cx("h-full", landingCardHover)}>
                <Icon className="text-2xl text-brand-strong" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-bold text-primary">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{feature.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="planes" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase text-muted">Planes</p>
          <h2 className="mt-2 text-3xl font-bold text-primary">Arranca gratis, escala cuando la agenda se ponga seria.</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <Card key={plan.name} className={cx("h-full", landingCardHover, plan.highlighted ? "border-brand bg-brand-soft" : "")}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-primary">{plan.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{plan.description}</p>
                </div>
                {plan.highlighted ? <Badge tone="brand">Popular</Badge> : null}
              </div>
              <p className="mt-6 text-4xl font-bold text-primary">{plan.price}</p>
              <p className="text-sm text-muted">ARS / mes</p>
              <ul className="mt-6 grid gap-3">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <FiCheckCircle className="text-success" aria-hidden="true" />
                    {perk}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
