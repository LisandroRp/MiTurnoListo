import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(relativePath, mocks = {}) {
  const url = new URL(relativePath, import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => mocks[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
  }).outputText, url.pathname);
  return loaded.exports;
}
const pricing = load("../../scheduling/subscription-pricing.ts");
const content = load("../landing-content.ts", {
  "@/lib/subscription-plans": { getSubscriptionPrices: () => ({ pro: 30000, unlimited: 55000 }) },
  "@/features/scheduling/subscription-pricing": pricing
});
const { PublicLanding } = load("./PublicLanding.tsx", {
  "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
  "@/components/composed/BrandMark": { BrandMark: () => null },
  "@/components/composed/PublicSupportContact": { PublicSupportContact: () => null },
  "@/components/ui/Badge": { Badge: ({ children }) => createElement("span", null, children) },
  "@/components/ui/Button": { Button: ({ children, disabled }) => createElement("button", { disabled }, children) },
  "@/components/ui/Card": { Card: ({ children, className }) => createElement("article", { className }, children) },
  "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
  "@/features/landing/components/LandingAnchorLink": { LandingAnchorLink: ({ children }) => createElement("a", null, children) },
  "@/features/landing/landing-content": content
});

test("landing publishes all three plans with available signup and plan entry points", () => {
  const html = renderToStaticMarkup(createElement(PublicLanding));
  const section = html.match(/<section id="planes"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section);
  assert.match(section, /lg:grid-cols-3/);
  assert.match(section, /lg:grid-rows-subgrid/);
  assert.deepEqual(content.landingPlans.map((plan) => plan.perks.slice(0, 3)), [
    ["Hasta 1 integrante visible del personal", "Hasta 2 servicios visibles", "Hasta 15 turnos por mes"],
    ["Hasta 3 integrantes visibles del personal", "Hasta 10 servicios visibles", "Hasta 150 turnos por mes"],
    ["Personal ilimitado", "Servicios activos ilimitados", "Turnos ilimitados"]
  ]);
  const cards = [...section.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/g)].map((match) => match[1]);
  assert.equal(cards.length, 3);
  assert.match(cards[0], /15 turnos/);
  assert.match(cards[0], /href="\/login\?mode=signup"/);
  assert.match(cards[1], /PRO/);
  assert.match(cards[1], /30\.000/);
  assert.match(cards[1], /150 turnos/);
  assert.match(cards[1], /3 integrantes/);
  assert.match(cards[1], /10 servicios/);
  assert.match(cards[1], /href="\/perfil#planes"/);
  assert.match(cards[2], /INFINITY/);
  assert.match(cards[2], /55\.000/);
  assert.match(cards[2], /href="\/perfil#planes"/);
  assert.doesNotMatch(section, /Próximamente|Las condiciones de los planes actuales se mantienen/);
  for (const card of cards.slice(1)) assert.match(card, /Reservas por link y QR/);
  assert.match(cards[1], /Pagos online y estadísticas básicas/);
  assert.match(cards[2], /Pagos online, estadísticas completas y avanzadas/);
});

test("structured data only offers plans that are currently available", () => {
  const html = renderToStaticMarkup(createElement(PublicLanding));
  const json = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const offers = json["@graph"].find((node) => node["@type"] === "SoftwareApplication").offers;
  assert.deepEqual(offers.map(({ name, price }) => ({ name, price })), [
    { name: "FREE", price: "0" }, { name: "PRO", price: "30000" }, { name: "INFINITY", price: "55000" }
  ]);
});

test("landing cards use the same configured amounts as their search offers", () => {
  const dynamic = load("../landing-content.ts", {
    "@/lib/subscription-plans": { getSubscriptionPrices: () => ({ pro: 29000, unlimited: 62000 }) },
    "@/features/scheduling/subscription-pricing": pricing
  });
  assert.deepEqual(dynamic.landingPlans.map(({ amount, price }) => ({ amount, price })), [
    { amount: 0, price: "$0" }, { amount: 29000, price: "$29.000" }, { amount: 62000, price: "$62.000" }
  ]);
});
