import Link from "next/link";
import { ReactNode } from "react";
import {
  FiArrowRight,
  FiBarChart2,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiGift,
  FiLink,
  FiMessageCircle,
  FiShare2,
  FiSmartphone,
  FiUsers
} from "react-icons/fi";

import { BrandMark } from "@/components/composed/BrandMark";
import { PublicSupportContact } from "@/components/composed/PublicSupportContact";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cx } from "@/components/ui/utils";
import { LandingAnchorLink } from "@/features/landing/components/LandingAnchorLink";
import {
  getSiteUrl,
  landingCardHover,
  landingCtaLarge,
  landingCtaPrimary,
  landingCtaSecondary,
  landingPlans
} from "@/features/landing/landing-content";

const bookingSteps = [
  { title: "Servicio", description: "Servicio seleccionado", meta: "30 min" },
  { title: "Profesional", description: "Profesional disponible", meta: "Sin cruces" },
  { title: "Día", description: "Jueves 16", meta: "Agenda abierta" },
  { title: "Horario", description: "18:30", meta: "Confirmación inmediata" }
];

const benefits = [
  {
    icon: FiMessageCircle,
    title: "Menos WhatsApp",
    description: "Dejá de coordinar ida y vuelta. Tus clientes eligen un horario disponible y la agenda se actualiza sola."
  },
  {
    icon: FiLink,
    title: "Un link para recibir reservas",
    description: "Compartilo en Instagram, Google o tus campañas. Cada servicio puede recibir reservas online sin fricción."
  },
  {
    icon: FiUsers,
    title: "Equipo sin superposiciones",
    description: "Conectá servicios, profesionales y disponibilidad para evitar reservas imposibles o dobles turnos."
  }
];

const features = [
  { icon: FiCalendar, title: "Agenda virtual", description: "Mirá día, semana y mes sin perder de vista quién atiende cada turno." },
  { icon: FiUsers, title: "Equipo ordenado", description: "Cargá personal, disponibilidad y servicios para evitar cruces raros." },
  { icon: FiBarChart2, title: "Datos rápidos", description: "Tenés caja estimada, cancelaciones y actividad diaria en el inicio." },
  { icon: FiClock, title: "Configuración simple", description: "Servicios con duración, anticipo, capacidad y horarios disponibles." }
];

const faqs = [
  {
    question: "¿Necesito instalar algo?",
    answer: "No. MiTurnoListo funciona desde el navegador y podés compartir tu link de reservas apenas configurás servicios, equipo y horarios."
  },
  {
    question: "¿Sirve si trabajo solo?",
    answer: "Sí. Podés usarlo como agenda individual y sumar más profesionales cuando el negocio crezca."
  },
  {
    question: "¿Puedo empezar sin pagar?",
    answer: "Sí. El plan gratis te permite validar el flujo con tus primeros servicios, profesionales y reservas online."
  }
];

const siteUrl = getSiteUrl();
const homeUrl = `${siteUrl}/`;
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "MiTurnoListo",
      alternateName: "Mi Turno Listo",
      url: homeUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/branding/logo.png`,
        width: 1254,
        height: 1254
      },
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "contacto@miturnolisto.com",
          availableLanguage: ["es"]
        }
      ]
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "MiTurnoListo",
      alternateName: "Mi Turno Listo",
      url: homeUrl,
      inLanguage: "es-AR",
      publisher: {
        "@id": `${siteUrl}/#organization`
      }
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      name: "MiTurnoListo",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: homeUrl,
      description: "Agenda virtual y organizador de turnos online para gestionar reservas, horarios, personal, pagos y clientes en negocios de servicios.",
      offers: [
        {
          "@type": "Offer",
          name: "Gratis",
          price: "0",
          priceCurrency: "ARS"
        },
        {
          "@type": "Offer",
          name: "Premium",
          price: "25000",
          priceCurrency: "ARS"
        }
      ],
      publisher: {
        "@id": `${siteUrl}/#organization`
      }
    }
  ]
};

export function PublicLanding() {
  return (
    <main className="min-h-screen bg-page text-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <header className="sticky top-0 z-30 border-b border-subtle bg-sidebar/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="block">
            <BrandMark variant="full" size="md" priority />
          </Link>
          <nav className="flex items-center gap-2">
            <LandingAnchorLink targetId="como-funciona" className="hidden cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-strong hover:text-primary sm:inline-flex">
              Cómo funciona
            </LandingAnchorLink>
            <LandingAnchorLink targetId="planes" className="hidden cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-strong hover:text-primary sm:inline-flex">
              Planes
            </LandingAnchorLink>
            <Link href="/login" className={cx(landingCtaPrimary, "hidden sm:inline-flex")}>Login</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-center">
          <Badge tone="brand" className="w-fit">Turnos, equipo y servicios en un solo lugar</Badge>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight text-primary sm:text-6xl">
            Tus clientes reservan solos. Vos ocupate de tu negocio.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
            Compartí tu link y dejá que elijan servicio, profesional, día y horario. Organizá toda tu agenda desde MiTurnoListo sin vivir pendiente de WhatsApp.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login?mode=signup" className={cx(landingCtaPrimary, landingCtaLarge)} data-cta="hero_signup" data-vertical="home">
              Empezá gratis <FiArrowRight />
            </Link>
            <LandingAnchorLink targetId="como-funciona" className={cx(landingCtaSecondary, landingCtaLarge)} data-cta="how_it_works" data-vertical="home">
              Ver cómo funciona
            </LandingAnchorLink>
          </div>
        </div>

        <BookingFlowPreview />
      </section>

      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase text-muted">Cómo reserva un cliente</p>
          <h2 className="mt-2 text-3xl font-bold text-primary">Compartís un link. El cliente completa el turno en minutos.</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {bookingSteps.map((step, index) => (
            <Card key={step.title} className={cx("h-full", landingCardHover)}>
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-sm font-bold text-brand-strong">
                  {index + 1}
                </span>
                <FiArrowRight className={cx("text-lg text-muted", index === bookingSteps.length - 1 ? "opacity-0" : "hidden md:block")} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-primary">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.description}</p>
              <p className="mt-4 text-xs font-bold uppercase text-brand-strong">{step.meta}</p>
            </Card>
          ))}
        </div>
        <Card className="mt-4 border-brand bg-brand-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-brand-strong">Reserva confirmada</p>
              <p className="mt-1 text-base font-semibold text-primary">El cliente recibe la confirmación y vos ves el turno en tu agenda.</p>
            </div>
            <Link href="/login?mode=signup" className={cx(landingCtaPrimary, "w-full sm:w-auto")} data-cta="how_it_works" data-vertical="home">
              Probar gratis <FiArrowRight />
            </Link>
          </div>
        </Card>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;

            return (
              <Card key={benefit.title} className={cx("h-full", landingCardHover)}>
                <Icon className="text-2xl text-brand-strong" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-bold text-primary">{benefit.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{benefit.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="text-sm font-bold uppercase text-muted">Panel de gestión</p>
          <h2 className="mt-2 text-3xl font-bold text-primary">Todo lo que necesitás para ordenar la agenda diaria.</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Después de que el cliente reserva, MiTurnoListo te ayuda a manejar servicios, profesionales, horarios, pagos y actividad sin perder contexto.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <Card key={feature.title} className={cx("h-full", landingCardHover)}>
                <Icon className="text-2xl text-brand-strong" aria-hidden="true" />
                <h3 className="mt-4 text-lg font-bold text-primary">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{feature.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 rounded-lg border border-subtle bg-sidebar p-5 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <div>
            <p className="text-sm font-bold uppercase text-muted">MiTurnoListo funciona para</p>
            <h2 className="mt-2 text-2xl font-bold text-primary">Landings pensadas para tu tipo de negocio.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <VerticalLink href="/barberias" title="Barberías" description="Cortes, barba y equipo." />
            <VerticalLink href="/peluquerias" title="Peluquerías" description="Color, brushing y servicios." />
            <VerticalLink href="/estetica" title="Centros de estética" description="Tratamientos y turnos 24/7." />
          </div>
        </div>
      </section>

      <section id="planes" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase text-muted">Planes</p>
          <h2 className="mt-2 text-3xl font-bold text-primary">Arrancá gratis, escalá cuando la agenda se ponga seria.</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {landingPlans.map((plan) => (
            <Card
              key={plan.name}
              className={cx(
                "relative h-full overflow-hidden",
                landingCardHover,
                plan.highlighted ? "border-brand bg-brand-soft shadow-lg ring-2 ring-brand/20" : ""
              )}
            >
              {plan.highlighted ? <div className="absolute inset-x-0 top-0 h-1.5 bg-brand" /> : null}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-primary">{plan.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{plan.description}</p>
                </div>
                {plan.highlighted ? <Badge tone="brand">Popular</Badge> : null}
              </div>
              <p className={cx("mt-6 text-4xl font-bold", plan.highlighted ? "text-brand-strong" : "text-primary")}>{plan.price}</p>
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

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {faqs.map((faq) => (
            <Card key={faq.question} className="h-full">
              <h2 className="text-base font-bold text-primary">{faq.question}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{faq.answer}</p>
            </Card>
          ))}
        </div>
      </section>

      <section id="referidos" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 rounded-lg border border-subtle bg-sidebar p-5 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <Badge tone="brand" className="w-fit">Referidos</Badge>
            <h2 className="mt-3 text-2xl font-bold text-primary">Compartí MiTurnoListo y ganá meses Premium.</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              Cuando una cuenta nueva se suscribe a Premium con tu código, sumás 30 días de PRO acumulables hasta un máximo de 3 meses.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ReferralLandingStep icon={<FiGift />} title="Activá tu código" description="Generalo desde el panel de referidos." />
            <ReferralLandingStep icon={<FiShare2 />} title="Invitá" description="Tu link lleva directo al signup." />
            <ReferralLandingStep icon={<FiCheckCircle />} title="Ganás PRO" description="La recompensa llega con el primer pago aprobado." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-lg border border-brand bg-brand-soft p-6 text-center">
          <h2 className="text-3xl font-bold text-primary">Dejá que tus clientes reserven sin escribirte por WhatsApp.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted">
            Creá tu cuenta, configurá tus servicios y compartí tu link para empezar a recibir turnos online.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/login?mode=signup" className={cx(landingCtaPrimary, landingCtaLarge)} data-cta="bottom_signup" data-vertical="home">
              Empezá gratis <FiArrowRight />
            </Link>
          </div>
        </div>
      </section>

      <PublicSupportContact />
    </main>
  );
}

function BookingFlowPreview() {
  return (
    <Card className={cx("bg-sidebar", landingCardHover)}>
      <div className="flex items-center justify-between gap-4 border-b border-subtle pb-4">
        <div>
          <p className="mt-1 text-xl font-bold text-primary">Reservar en MiTurnoListo</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-soft text-2xl text-brand-strong">
          <FiSmartphone aria-hidden="true" />
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {bookingSteps.map((step, index) => (
          <div key={step.title} className="flex items-center gap-3 rounded-lg border border-subtle bg-input p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-bold text-brand-strong">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-primary">{step.title}</p>
              <p className="truncate text-sm text-muted">{step.description}</p>
            </div>
            <FiCheckCircle className="shrink-0 text-success" aria-hidden="true" />
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-brand bg-brand-soft p-4">
        <p className="text-sm font-bold text-brand-strong">Reserva confirmada</p>
        <p className="mt-1 text-sm leading-6 text-muted">El horario queda bloqueado y aparece en el panel del negocio.</p>
      </div>
    </Card>
  );
}

function VerticalLink({
  description,
  href,
  title
}: {
  description: string;
  href: string;
  title: string;
}) {
  return (
    <Link href={href} className="rounded-lg border border-subtle bg-input p-4 transition-colors hover:bg-surface-strong">
      <span className="text-base font-bold text-primary">{title}</span>
      <span className="mt-1 block text-sm leading-6 text-muted">{description}</span>
    </Link>
  );
}

function ReferralLandingStep({
  description,
  icon,
  title
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-subtle bg-input p-4">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-xl text-brand-strong">
        {icon}
      </span>
      <h3 className="mt-4 text-base font-bold text-primary">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}
