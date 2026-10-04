import Link from "next/link";
import { ReactNode } from "react";
import {
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiLink,
  FiMessageCircle,
  FiScissors,
  FiSettings,
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
import { VerticalLandingConfig } from "@/features/landing/verticals";

const howItWorksSteps = [
  "Creá tu cuenta",
  "Configurá servicios y personal",
  "Compartí tu link",
  "Recibí turnos"
] as const;

const customerFlowSteps = [
  "Elegir servicio",
  "Elegir profesional",
  "Elegir día y horario",
  "Turno confirmado"
] as const;

const benefits = [
  {
    icon: FiClock,
    title: "Reservas online 24/7",
    description: "Tus clientes reservan incluso cuando vos no estás respondiendo mensajes."
  },
  {
    icon: FiCalendar,
    title: "Agenda organizada",
    description: "Visualizá todos tus turnos desde un mismo lugar."
  },
  {
    icon: FiUsers,
    title: "Gestión de personal",
    description: "Configurá quién realiza cada servicio y sus horarios disponibles."
  },
  {
    icon: FiSettings,
    title: "Servicios personalizados",
    description: "Definí duración, precio y disponibilidad."
  },
  {
    icon: FiLink,
    title: "Tu propio link",
    description: "Compartilo por Instagram, WhatsApp o donde quieras."
  }
] as const;

export function VerticalLanding({ config }: { config: VerticalLandingConfig }) {
  const structuredData = buildStructuredData(config);

  return (
    <main className="min-h-screen bg-page text-primary">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <VerticalHeader />
      <HeroSection config={config} />
      <ProblemSection config={config} />
      <HowItWorksSection config={config} />
      <CustomerExperienceSection config={config} />
      <BenefitsSection />
      <PricingSection config={config} />
      <FaqSection config={config} />
      <FinalCta config={config} />
      <PublicSupportContact />
    </main>
  );
}

function VerticalHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-subtle bg-sidebar/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="block" aria-label="Ir a la home de MiTurnoListo">
          <BrandMark variant="full" size="md" priority />
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/" className="hidden cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-strong hover:text-primary sm:inline-flex">
            Home
          </Link>
          <LandingAnchorLink targetId="planes" className="hidden cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-strong hover:text-primary sm:inline-flex">
            Planes
          </LandingAnchorLink>
          <Link href="/login?mode=signup" className={cx(landingCtaPrimary, "hidden sm:inline-flex")}>
            Empezá gratis
          </Link>
        </nav>
      </div>
    </header>
  );
}

function HeroSection({ config }: { config: VerticalLandingConfig }) {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex flex-col justify-center">
        <Badge tone="brand" className="w-fit">{config.eyebrow}</Badge>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight text-primary sm:text-6xl">
          {config.heroTitle}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
          {config.heroDescription}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <TrackedSignupLink config={config} cta="hero_signup" className={cx(landingCtaPrimary, landingCtaLarge)}>
            Empezá gratis <FiArrowRight />
          </TrackedSignupLink>
          <LandingAnchorLink
            targetId="como-funciona"
            className={cx(landingCtaSecondary, landingCtaLarge)}
            data-cta="how_it_works"
            data-vertical={config.key}
          >
            Ver cómo funciona
          </LandingAnchorLink>
        </div>
      </div>
      <VerticalBookingPreview config={config} />
    </section>
  );
}

function VerticalBookingPreview({ config }: { config: VerticalLandingConfig }) {
  return (
    <Card className={cx("bg-sidebar", landingCardHover)}>
      <div className="flex items-center justify-between gap-4 border-b border-subtle pb-4">
        <div>
          <p className="text-sm font-semibold text-brand-strong">Reserva online</p>
          <p className="mt-1 text-xl font-bold text-primary">Así lo ve tu cliente</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-soft text-2xl text-brand-strong">
          <FiScissors aria-hidden="true" />
        </span>
      </div>
      <div className="mt-5 grid gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-muted">Servicios</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {config.services.map((service) => (
              <span key={service} className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
                {service}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-subtle bg-input p-4">
          <p className="text-xs font-bold uppercase text-muted">Personal</p>
          <div className="mt-3 grid gap-2">
            {config.professionals.map((professional) => (
              <div key={professional} className="flex items-center justify-between gap-3 rounded-lg bg-surface p-3">
                <span className="font-semibold text-primary">{professional}</span>
                <span className="text-sm font-semibold text-success">Disponible</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-subtle bg-input p-4">
            <p className="text-xs font-bold uppercase text-muted">Día</p>
            <p className="mt-2 text-lg font-bold text-primary">Jueves 16</p>
          </div>
          <div className="rounded-lg border border-brand bg-brand-soft p-4">
            <p className="text-xs font-bold uppercase text-brand-strong">Horario</p>
            <p className="mt-2 text-lg font-bold text-primary">18:30</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProblemSection({ config }: { config: VerticalLandingConfig }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase text-muted">El problema</p>
        <h2 className="mt-2 text-3xl font-bold text-primary">Dejá de coordinar cada turno por WhatsApp.</h2>
        <p className="mt-4 text-base leading-7 text-muted">
          Responder disponibilidad, confirmar horarios y reorganizar cancelaciones lleva tiempo. Con MiTurnoListo, tus clientes ven tus horarios disponibles y reservan por su cuenta.
        </p>
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="bg-sidebar">
          <Badge>Antes</Badge>
          <div className="mt-5 grid gap-3 text-sm font-semibold">
            {config.beforeConversation.map((message) => (
              <MessageBubble
                key={`${message.speaker}-${message.text}`}
                label={message.speaker}
                text={message.text}
                align={message.speaker === "Negocio" ? "right" : "left"}
              />
            ))}
          </div>
        </Card>
        <div className="grid gap-4 self-start">
          <Card className="border-brand bg-brand-soft">
            <Badge tone="brand" className="w-fit">Ahora</Badge>
            <div className="mt-5 grid gap-3">
              {["Servicio", "Personal", "Día", "Horario"].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-lg border border-brand/25 bg-surface p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-bold text-brand-strong">
                    {index + 1}
                  </span>
                  <p className="min-w-0 text-sm font-bold leading-5 text-primary">{step}</p>
                </div>
              ))}
              <div className="flex items-center gap-3 rounded-lg border border-brand bg-surface p-4">
                <FiCheckCircle className="shrink-0 text-2xl text-success" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-base font-bold leading-6 text-primary">Reserva confirmada</p>
                  <p className="mt-1 text-sm leading-6 text-muted">El turno queda guardado en tu agenda.</p>
                </div>
              </div>
            </div>
          </Card>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {config.contrastHighlights.map((highlight) => (
              <MetricCard key={highlight.title} title={highlight.title} description={highlight.description} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ description, title }: { description: string; title: string }) {
  return (
    <div className="rounded-lg border border-subtle bg-sidebar p-4 shadow-sm">
      <p className="text-base font-bold text-brand-strong">{title}</p>
      <p className="mt-1 text-sm font-semibold leading-5 text-muted">{description}</p>
    </div>
  );
}

function HowItWorksSection({ config }: { config: VerticalLandingConfig }) {
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase text-muted">Cómo funciona</p>
        <h2 className="mt-2 text-3xl font-bold text-primary">Empezar lleva minutos</h2>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-4">
        {howItWorksSteps.map((step, index) => (
          <Card key={step} className={cx("h-full", landingCardHover)}>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-sm font-bold text-brand-strong">
              {index + 1}
            </span>
            <h3 className="mt-4 text-lg font-bold text-primary">{step}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{getHowItWorksDescription(step, config)}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function CustomerExperienceSection({ config }: { config: VerticalLandingConfig }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="text-sm font-bold uppercase text-muted">Experiencia del cliente</p>
          <h2 className="mt-2 text-3xl font-bold text-primary">Reservar también tiene que ser fácil para tus clientes.</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            El flujo público mantiene los pasos importantes claros: servicio, profesional, día, horario y confirmación.
          </p>
        </div>
        <Card className={cx("bg-sidebar", landingCardHover)}>
          <div className="grid gap-3">
            {customerFlowSteps.map((step, index) => (
              <div key={step} className="flex items-center gap-3 rounded-lg border border-subtle bg-input p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-bold text-brand-strong">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm font-bold text-primary">{step}</span>
                <FiCheckCircle className="shrink-0 text-success" aria-hidden="true" />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-brand bg-brand-soft p-4">
            <p className="text-sm font-bold text-brand-strong">Listo para compartir</p>
            <p className="mt-1 text-sm leading-6 text-muted">Tus servicios de {config.eyebrow.toLowerCase().replace("turnos online para ", "")} quedan disponibles desde tu link.</p>
          </div>
        </Card>
      </div>
    </section>
  );
}

function BenefitsSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {benefits.map((benefit) => {
          const Icon = benefit.icon;

          return (
            <Card key={benefit.title} className={cx("h-full", landingCardHover)}>
              <Icon className="text-2xl text-brand-strong" aria-hidden="true" />
              <h2 className="mt-4 text-base font-bold text-primary">{benefit.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{benefit.description}</p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function PricingSection({ config }: { config: VerticalLandingConfig }) {
  return (
    <section id="planes" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase text-muted">Planes</p>
        <h2 className="mt-2 text-3xl font-bold text-primary">Empezá gratis. Crecé cuando lo necesites.</h2>
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
            <div className="mt-6">
              <TrackedSignupLink config={config} cta="pricing_signup" className={cx(landingCtaPrimary, "w-full")}>
                Empezá gratis <FiArrowRight />
              </TrackedSignupLink>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function FaqSection({ config }: { config: VerticalLandingConfig }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase text-muted">FAQ</p>
        <h2 className="mt-2 text-3xl font-bold text-primary">Preguntas frecuentes</h2>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {config.faq.map((faq) => (
          <Card key={faq.question} className="h-full">
            <h2 className="text-base font-bold text-primary">{faq.question}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{faq.answer}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function FinalCta({ config }: { config: VerticalLandingConfig }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="rounded-lg border border-brand bg-brand-soft p-6 text-center">
        <h2 className="text-3xl font-bold text-primary">Tu próximo turno puede reservarse solo.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted">
          Creá tu cuenta y compartí tu link de reservas.
        </p>
        <div className="mt-6 flex justify-center">
          <TrackedSignupLink config={config} cta="bottom_signup" className={cx(landingCtaPrimary, landingCtaLarge)}>
            Empezá gratis <FiArrowRight />
          </TrackedSignupLink>
        </div>
      </div>
    </section>
  );
}

function TrackedSignupLink({
  children,
  className,
  config,
  cta
}: {
  children: ReactNode;
  className: string;
  config: VerticalLandingConfig;
  cta: "hero_signup" | "pricing_signup" | "bottom_signup";
}) {
  return (
    <Link
      href="/login?mode=signup"
      className={className}
      data-cta={cta}
      data-vertical={config.key}
    >
      {children}
    </Link>
  );
}

function MessageBubble({
  align = "left",
  label,
  text
}: {
  align?: "left" | "right";
  label: string;
  text: string;
}) {
  return (
    <div className={cx("max-w-[18rem] rounded-lg border border-subtle bg-input p-3", align === "right" ? "ml-auto" : "")}>
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-1 text-primary">{text}</p>
    </div>
  );
}

function getHowItWorksDescription(step: (typeof howItWorksSteps)[number], config: VerticalLandingConfig) {
  switch (step) {
    case "Creá tu cuenta":
      return "Entrá al signup y prepará tu espacio de trabajo.";
    case "Configurá servicios y personal":
      return `Cargá ${config.services.slice(0, 2).join(", ")} y el equipo que atiende cada turno.`;
    case "Compartí tu link":
      return "Sumalo a WhatsApp, Instagram, Google o tus campañas.";
    case "Recibí turnos":
      return "Cada reserva confirmada aparece en tu agenda.";
  }
}

function buildStructuredData(config: VerticalLandingConfig) {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}${config.path}#software`,
        name: "MiTurnoListo",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: `${siteUrl}${config.path}`,
        description: config.seo.description,
        offers: landingPlans.map((plan) => ({
          "@type": "Offer",
          name: plan.name,
          price: plan.price === "$0" ? "0" : "25000",
          priceCurrency: "ARS"
        }))
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}${config.path}#faq`,
        mainEntity: config.faq.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer
          }
        }))
      }
    ]
  };
}
