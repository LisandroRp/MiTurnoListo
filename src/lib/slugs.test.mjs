import assert from "node:assert/strict";
import { test } from "node:test";

import { getSafePublicSlug, isReservedPublicSlug, isUuid, normalizeSlug } from "./slugs.ts";

test("normalizeSlug creates URL-safe slugs", () => {
  assert.equal(normalizeSlug("Mi Turno Listo!"), "mi-turno-listo");
  assert.equal(normalizeSlug(" Peluquería Núñez "), "peluqueria-nunez");
  assert.equal(normalizeSlug("***", "negocio"), "negocio");
});

test("isUuid detects UUID route keys", () => {
  assert.equal(isUuid("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isUuid("mi-negocio-corte"), false);
});

test("reserved public slugs are guarded for business URLs", () => {
  assert.equal(isReservedPublicSlug("login"), true);
  assert.equal(isReservedPublicSlug("turnos-studio"), false);
  assert.equal(getSafePublicSlug("Login", "negocio"), "login-negocio");
});
