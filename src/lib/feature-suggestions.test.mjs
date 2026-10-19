import assert from "node:assert/strict";
import test from "node:test";

import {
  featureSuggestionDescriptionMaxLength,
  featureSuggestionTitleMaxLength,
  isFeatureSuggestionStatus,
  validateFeatureSuggestionInput
} from "./feature-suggestions.ts";

test("feature suggestion validation trims valid text fields", () => {
  assert.deepEqual(validateFeatureSuggestionInput({
    description: "  Sería útil poder exportar los turnos.  ",
    title: "  Exportar agenda  "
  }), {
    input: {
      description: "Sería útil poder exportar los turnos.",
      title: "Exportar agenda"
    },
    isValid: true
  });
});

test("feature suggestion validation rejects missing, short or oversized text", () => {
  assert.deepEqual(validateFeatureSuggestionInput(null), { isValid: false });
  assert.deepEqual(validateFeatureSuggestionInput({ description: "Muy corto", title: "Ok" }), { isValid: false });
  assert.deepEqual(validateFeatureSuggestionInput({
    description: "a".repeat(featureSuggestionDescriptionMaxLength + 1),
    title: "Una mejora"
  }), { isValid: false });
  assert.deepEqual(validateFeatureSuggestionInput({
    description: "Una descripción suficientemente clara.",
    title: "a".repeat(featureSuggestionTitleMaxLength + 1)
  }), { isValid: false });
});

test("feature suggestion statuses only accept the supported review states", () => {
  assert.equal(isFeatureSuggestionStatus("pending"), true);
  assert.equal(isFeatureSuggestionStatus("done"), true);
  assert.equal(isFeatureSuggestionStatus("rejected"), true);
  assert.equal(isFeatureSuggestionStatus("approved"), false);
});
