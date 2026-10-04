import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const projectRoot = resolve(import.meta.dirname, "../../..");

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

test("public landing drives new visitors to signup and explains customer booking first", () => {
  const landing = readProjectFile("src/features/landing/components/PublicLanding.tsx");

  assert.equal(landing.includes('href="/login?mode=signup"'), true);
  assert.equal(landing.includes("Empezá gratis"), true);
  assert.equal(landing.includes("Tus clientes reservan solos. Vos ocupate de tu negocio."), true);
  assert.equal(landing.includes("Ver cómo funciona"), true);
  assert.equal(landing.includes('id="como-funciona"'), true);
  assert.equal(landing.includes("Cómo reserva un cliente"), true);
  assert.equal(landing.includes("Reserva confirmada"), true);
  assert.equal(landing.includes("Entrar al panel"), false);
});

test("public landing keeps referrals below pricing", () => {
  const landing = readProjectFile("src/features/landing/components/PublicLanding.tsx");
  const pricingIndex = landing.indexOf('id="planes"');
  const referralsIndex = landing.indexOf('id="referidos"');

  assert.notEqual(pricingIndex, -1);
  assert.notEqual(referralsIndex, -1);
  assert.equal(pricingIndex < referralsIndex, true);
});

test("public landing copy uses accented Spanish for visible product text", () => {
  const landing = readProjectFile("src/features/landing/components/PublicLanding.tsx");
  const content = readProjectFile("src/features/landing/landing-content.ts");

  assert.equal(landing.includes("turnos para peluquerias"), false);
  assert.equal(landing.includes("centros de estetica"), false);
  assert.equal(landing.includes("configuracion"), false);
  assert.equal(landing.includes("estadisticas"), false);
  assert.equal(landing.includes("día"), true);
  assert.equal(landing.includes("Configuración"), true);
  assert.equal(content.includes("Estadísticas"), true);
});

test("global landing metadata keeps Spanish accents in crawler-visible copy", () => {
  const layout = readProjectFile("src/app/layout.tsx");

  assert.equal(layout.includes("Gestioná reservas"), true);
  assert.equal(layout.includes("gestión de turnos"), true);
  assert.equal(layout.includes("turnos para peluquerías"), true);
  assert.equal(layout.includes("turnos para centros de estética"), true);
});
