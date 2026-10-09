import assert from "node:assert/strict";
import test from "node:test";

import { getCatalogDescription, getProfessionalLabel, getServiceTitleOverflowClass } from "./catalog.ts";

const spanish = { services: { professionalColumn: "Profesional", professionalsColumn: "Profesionales" } };
const english = { services: { professionalColumn: "Professional", professionalsColumn: "Professionals" } };

test("public catalog uses the singular professional label for one assigned person", () => {
  assert.equal(getProfessionalLabel(1, spanish), "Profesional");
  assert.equal(getProfessionalLabel(1, english), "Professional");
});

test("public catalog uses the plural professional label for multiple assigned people", () => {
  assert.equal(getProfessionalLabel(2, spanish), "Profesionales");
  assert.equal(getProfessionalLabel(3, english), "Professionals");
});

test("catalog service titles use one line without spaces and up to two lines with spaces", () => {
  assert.equal(getServiceTitleOverflowClass("DERMATOLOGIA"), "truncate");
  assert.equal(getServiceTitleOverflowClass("MEDICA CLINICA / NEUMONOLOGIA"), "line-clamp-2");
  assert.equal(getServiceTitleOverflowClass("  NUTRICION  "), "truncate");
});

test("catalog leaves the description empty when no meaningful text is provided", () => {
  assert.equal(getCatalogDescription(""), "");
  assert.equal(getCatalogDescription("   "), "");
  assert.equal(getCatalogDescription("  Consulta inicial  "), "Consulta inicial");
});
