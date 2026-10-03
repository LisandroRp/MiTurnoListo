import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCustomFieldResponses,
  hasValidServiceCustomFields,
  normalizeServiceCustomFields
} from "./service-custom-fields.ts";

test("normalizeServiceCustomFields trims labels, removes empty fields and caps at three", () => {
  assert.deepEqual(normalizeServiceCustomFields([
    { id: "insurance", label: " Obra social ", isRequired: true, sortOrder: 99 },
    { id: "empty", label: " ", isRequired: false, sortOrder: 99 },
    { id: "member-id", label: "Credencial", isRequired: false, sortOrder: 99 },
    { id: "notes", label: "Indicaciones", isRequired: false, sortOrder: 99 },
    { id: "extra", label: "Extra", isRequired: false, sortOrder: 99 }
  ]), [
    { id: "insurance", label: "Obra social", isRequired: true, sortOrder: 0 },
    { id: "member-id", label: "Credencial", isRequired: false, sortOrder: 1 },
    { id: "notes", label: "Indicaciones", isRequired: false, sortOrder: 2 }
  ]);
});

test("hasValidServiceCustomFields rejects blank labels and more than three fields", () => {
  assert.equal(hasValidServiceCustomFields([
    { id: "insurance", label: "Obra social", isRequired: true, sortOrder: 0 }
  ]), true);
  assert.equal(hasValidServiceCustomFields([
    { id: "insurance", label: "", isRequired: true, sortOrder: 0 }
  ]), false);
  assert.equal(hasValidServiceCustomFields([
    { id: "one", label: "Uno", isRequired: false, sortOrder: 0 },
    { id: "two", label: "Dos", isRequired: false, sortOrder: 1 },
    { id: "three", label: "Tres", isRequired: false, sortOrder: 2 },
    { id: "four", label: "Cuatro", isRequired: false, sortOrder: 3 }
  ]), false);
});

test("buildCustomFieldResponses stores label snapshots and trimmed values", () => {
  assert.deepEqual(buildCustomFieldResponses([
    { id: "insurance", label: "Obra social", isRequired: true, sortOrder: 0 },
    { id: "member-id", label: "Credencial", isRequired: false, sortOrder: 1 }
  ], {
    insurance: " OSDE ",
    "member-id": " 12345 "
  }), [
    { id: "insurance", label: "Obra social", isRequired: true, sortOrder: 0, value: "OSDE" },
    { id: "member-id", label: "Credencial", isRequired: false, sortOrder: 1, value: "12345" }
  ]);
});
