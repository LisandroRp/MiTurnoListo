import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const projectRoot = resolve(import.meta.dirname, "../../..");

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

const verticals = [
  {
    key: "barberias",
    title: "Sistema de turnos para barberías | MiTurnoListo",
    description: "Turnos online para barberías. Organizá servicios, personal y horarios y permití que tus clientes reserven desde un link.",
    h1: "Que tus clientes reserven sin mandarte un WhatsApp."
  },
  {
    key: "peluquerias",
    title: "Sistema de turnos para peluquerías | MiTurnoListo",
    description: "Agenda y turnos online para peluquerías. Organizá servicios, personal y horarios y recibí reservas desde tu propio link.",
    h1: "Tus clientes reservan solos. Vos ocupate de tu peluquería."
  },
  {
    key: "estetica",
    title: "Sistema de turnos para centros de estética | MiTurnoListo",
    description: "Turnos online para centros de estética. Gestioná tratamientos, personal y horarios y recibí reservas online las 24 horas.",
    h1: "Menos mensajes. Más turnos organizados."
  }
];

test("vertical routes select configuration instead of duplicating page content", () => {
  for (const vertical of verticals) {
    const page = readProjectFile(`src/app/${vertical.key}/page.tsx`);
    const og = readProjectFile(`src/app/${vertical.key}/opengraph-image.tsx`);

    assert.equal(page.includes(`verticalLandingConfigs.${vertical.key}`), true);
    assert.equal(page.includes("<VerticalLanding config={config} />"), true);
    assert.equal(og.includes(`verticalLandingConfigs.${vertical.key}`), true);
    assert.equal(og.includes("renderVerticalOpenGraphImage"), true);
  }
});

test("vertical configs include required SEO and hero copy", () => {
  const config = readProjectFile("src/features/landing/verticals.ts");

  for (const vertical of verticals) {
    assert.equal(config.includes(vertical.title), true);
    assert.equal(config.includes(vertical.description), true);
    assert.equal(config.includes(vertical.h1), true);
    assert.equal(config.includes(`https://www.miturnolisto.com/${vertical.key}`), true);
  }
});

test("vertical landing exposes measurable CTAs and exact FAQ structured data source", () => {
  const component = readProjectFile("src/features/landing/components/VerticalLanding.tsx");

  assert.equal(component.includes('data-cta={cta}'), true);
  assert.equal(component.includes('data-vertical={config.key}'), true);
  assert.equal(component.includes('data-cta="how_it_works"'), true);
  assert.equal(component.includes("@type\": \"FAQPage\""), true);
  assert.equal(component.includes("config.faq.map((faq)"), true);
});

test("pricing is shared between home and vertical landings", () => {
  const home = readProjectFile("src/features/landing/components/PublicLanding.tsx");
  const vertical = readProjectFile("src/features/landing/components/VerticalLanding.tsx");
  const content = readProjectFile("src/features/landing/landing-content.ts");

  assert.equal(content.includes("landingPlans"), true);
  assert.equal(home.includes("landingPlans.map"), true);
  assert.equal(vertical.includes("landingPlans.map"), true);
});

test("sitemap and public home link to vertical landings", () => {
  const sitemap = readProjectFile("src/app/sitemap.ts");
  const home = readProjectFile("src/features/landing/components/PublicLanding.tsx");

  assert.equal(sitemap.includes("verticalLandingList"), true);
  assert.equal(home.includes('href="/barberias"'), true);
  assert.equal(home.includes('href="/peluquerias"'), true);
  assert.equal(home.includes('href="/estetica"'), true);
});
