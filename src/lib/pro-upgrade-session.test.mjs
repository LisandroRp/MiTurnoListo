import assert from "node:assert/strict";
import test from "node:test";
import { consumeProUpgradePrompt, resetProUpgradePrompt } from "./pro-upgrade-session.ts";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

test("Free accounts see the prompt from ten appointments, including at and above the limit", () => {
  for (const usage of [10, 14, 15, 18]) {
    assert.equal(consumeProUpgradePrompt(createStorage(), "owner", usage, "free"), true);
  }
});

test("the prompt is consumed on dashboard entry and does not return on navigation or reload", () => {
  const storage = createStorage();
  assert.equal(consumeProUpgradePrompt(storage, "owner", 10, "free"), true);
  assert.equal(consumeProUpgradePrompt(storage, "owner", 12, "free"), false);
  assert.equal(consumeProUpgradePrompt(storage, "owner", 15, "free"), false);
});

test("an account below ten on entry is not interrupted after creating more appointments", () => {
  const storage = createStorage();
  assert.equal(consumeProUpgradePrompt(storage, "owner", 9, "free"), false);
  assert.equal(consumeProUpgradePrompt(storage, "owner", 10, "free"), false);
});

test("a new login allows the eligible account to see the prompt again", () => {
  const storage = createStorage();
  assert.equal(consumeProUpgradePrompt(storage, "owner", 12, "free"), true);
  resetProUpgradePrompt(storage);
  assert.equal(consumeProUpgradePrompt(storage, "owner", 12, "free"), true);
});

test("paid or referral Pro accounts never receive an upgrade prompt", () => {
  assert.equal(consumeProUpgradePrompt(createStorage(), "owner", 15, "pro"), false);
});

test("another account does not inherit the previous account's dismissed prompt", () => {
  const storage = createStorage();
  consumeProUpgradePrompt(storage, "owner", 12, "free");
  assert.equal(consumeProUpgradePrompt(storage, "another-owner", 12, "free"), true);
});
