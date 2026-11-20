import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { capServiceNumericInput, hasValidServiceNumericLimits } from "./service-numeric-limits.ts";

const valid = { price: 10_000_000, deposit: 5_000_000, durationMinutes: 300 };
test("service price, deposit and duration accept their boundary and reject invalid values", () => {
  assert.equal(hasValidServiceNumericLimits(valid), true);
  assert.equal(hasValidServiceNumericLimits({ price: 1, deposit: 0, durationMinutes: 1 }), true);
  for (const change of [{ price: 10_000_001 }, { price: 0 }, { price: 1.5 }, { price: Infinity }, { deposit: 5_000_001 }, { deposit: -1 }, { price: 100, deposit: 101 }, { durationMinutes: 301 }, { durationMinutes: 0 }, { durationMinutes: 1.5 }]) {
    assert.equal(hasValidServiceNumericLimits({ ...valid, ...change }), false, JSON.stringify(change));
  }
});

test("typed or pasted input is capped only for the three requested fields", () => {
  for (const [field, maximum] of [["price", 10_000_000], ["deposit", 5_000_000], ["durationMinutes", 300]]) {
    assert.equal(capServiceNumericInput(field, maximum + 1), maximum);
    assert.equal(capServiceNumericInput(field, 0), 0);
    assert.equal(capServiceNumericInput(field, maximum - 1), maximum - 1);
  }
  assert.equal(capServiceNumericInput("capacity", 1000), 1000);
  const source = readFileSync(new URL("./components/ServicesView.tsx", import.meta.url), "utf8");
  assert.match(source, /capServiceNumericInput\(field, parseNumericInput\(event.target.value\)\)/);
  assert.match(source, /hasValidServiceNumericLimits\(service\)/);
});


test("service fields show only the duration limit and relevant deposit validation", () => {
  const source = readFileSync(new URL("./components/ServicesView.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /priceLimitHint|depositLimitHint/);
  assert.match(source, /helperText=\{messages.services.durationLimitHint\}/);
  assert.match(source, /helperText=\{draft.deposit > draft.price \? messages.services.depositExceedsPrice : undefined\}/);
});
