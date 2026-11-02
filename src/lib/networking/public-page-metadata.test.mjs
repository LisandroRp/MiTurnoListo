import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as slugs from "../slugs.ts";

const require = createRequire(import.meta.url);
function setup({ business = { id: "business", name: "Clinic", public_slug: "clinic", subscription_tier: "pro" }, service = { id: "service", name: "Cardiology", public_slug: "cardiology" }, error = false, publicAccess = null } = {}) {
  const filters = [];
  const db = {
    from: (table) => {
      const chain = {
        select: () => chain, limit: () => chain,
        eq: (field, value) => { filters.push({ table, field, value }); return chain; },
        maybeSingle: async () => {
          if (error) throw new Error("Connection failed");
          return { data: table === "businesses" ? business : service };
        }
      };
      return chain;
    }
  };
  const modules = {
    "server-only": {},
    "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => db },
    "@/lib/networking/free-plan-public-access": { getFreePlanPublicAccess: async () => publicAccess },
    "@/lib/slugs": slugs
  };
  const url = new URL("./public-page-metadata.ts", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  return { metadata: loaded.exports.getPublicPageMetadata, filters };
}

function assertBrandImage(metadata) {
  assert.deepEqual(metadata.openGraph.images, [{ url: "/branding/og-image.png", width: 1200, height: 630, alt: "MiTurnoListo" }]);
  assert.deepEqual(metadata.twitter.images, ["/branding/og-image.png"]);
}

test("catalog sharing identifies the business and keeps the original brand image", async () => {
  const metadata = await setup().metadata("clinic");
  assert.match(metadata.openGraph.title, /Clinic/);
  assert.match(metadata.description, /servicios de Clinic/);
  assert.equal(metadata.openGraph.url, "/clinic");
  assert.equal(metadata.alternates.canonical, "/clinic");
  assert.equal(metadata.robots.index, true);
  assertBrandImage(metadata);
});

test("service sharing identifies both service and business and only queries public active services", async () => {
  const app = setup();
  const metadata = await app.metadata("clinic", "cardiology");
  assert.match(metadata.openGraph.title, /Cardiology en Clinic/);
  assert.match(metadata.description, /Cardiology en Clinic/);
  assert.equal(metadata.twitter.title, metadata.openGraph.title);
  assert.equal(metadata.openGraph.url, "/clinic/cardiology");
  for (const field of ["is_public", "is_active"]) assert.ok(app.filters.some((filter) => filter.table === "services" && filter.field === field && filter.value === true));
  assert.ok(app.filters.some((filter) => filter.table === "services" && filter.field === "business_id" && filter.value === "business"));
  assertBrandImage(metadata);
});

test("unavailable, reserved and failed metadata queries fall back without exposing service details", async () => {
  for (const [options, businessKey, serviceKey] of [[{ business: null }, "missing"], [{ service: null }, "clinic", "missing"], [{ error: true }, "clinic"], [{}, "login"], [{ publicAccess: { serviceIds: new Set() } }, "clinic", "cardiology"]]) {
    const metadata = await setup(options).metadata(businessKey, serviceKey);
    assert.equal(metadata.robots.index, false);
    assert.doesNotMatch(metadata.openGraph.title, /Clinic|Cardiology/);
    assertBrandImage(metadata);
  }
});

test("both dynamic public routes generate their own metadata", () => {
  for (const path of ["../../app/[businessSlug]/page.tsx", "../../app/[businessSlug]/[serviceSlug]/page.tsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /export async function generateMetadata/);
    assert.match(source, /return getPublicPageMetadata\(businessSlug/);
  }
});


test("included Free plan services retain their own sharing metadata", async () => {
  const metadata = await setup({ publicAccess: { serviceIds: new Set(["service"]) } }).metadata("clinic", "cardiology");
  assert.equal(metadata.robots.index, true);
  assert.match(metadata.openGraph.title, /Cardiology en Clinic/);
});
