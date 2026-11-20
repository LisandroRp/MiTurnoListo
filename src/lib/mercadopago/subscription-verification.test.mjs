import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "../../..");
function load(relative, mocks = {}, cache = new Map()) {
  const file = resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = new Module(file);
  cache.set(file, loaded);
  loaded.require = (name) => name in mocks ? mocks[name] : name === "server-only" ? {} : name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`, mocks, cache) : require(name);
  loaded._compile(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
  return loaded.exports;
}
const policy = load("src/lib/mercadopago/subscription-verification-policy.ts");
function setup() {
  let time = 1_800_000_000_000, serial = 0;
  const states = new Map();
  const business = { subscription_tier: "pro" };
  const db = {
    async rpc(name, input) {
      const key = `${input.p_business_id}:${input.p_reference}`;
      const state = states.get(key) ?? {};
      if (name === "claim_subscription_verification") {
        if (state.review || state.retry > time || state.leaseUntil > time) return { data: { allowed: false, failure_kind: state.reason ?? "temporary", needs_review: state.review, retry_after: state.retry ? new Date(state.retry).toISOString() : null } };
        const token = `lease-${++serial}`;
        states.set(key, { cycles: state.cycles ?? 0, token, leaseUntil: time + 60_000 });
        return { data: { allowed: true, token } };
      }
      assert.equal(name, "finish_subscription_verification");
      if (state.token !== input.p_token) return { data: { applied: false } };
      const reason = input.p_outcome;
      const cycles = reason === "success" ? 0 : (state.cycles ?? 0) + (reason === "temporary" ? 1 : 0);
      const review = reason === "not_found" || reason === "permission" || cycles >= 2;
      const retry = reason === "temporary" && !review ? time + 30 * 60_000 : null;
      states.set(key, { cycles, attempts: input.p_attempts, reason, retry, review });
      return { data: { applied: true, needs_review: review, retry_after: retry ? new Date(retry).toISOString() : null } };
    },
    from(table) {
      assert.equal(table, "businesses");
      return { select() { return this; }, eq() { return this; }, single: async () => ({ data: business }) };
    }
  };
  const mocks = { "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => db }, "@/lib/mercadopago/subscription-verification-policy": policy };
  const service = () => load("src/lib/mercadopago/subscription-verification.ts", mocks).withSubscriptionVerification;
  const check = (verify, reference = "subscription:one") => service()({ businessId: "business", reference, verify });
  return { states, business, check, advance: (milliseconds) => { time += milliseconds; } };
}
const success = { businessId: "business", preapprovalId: "one", subscriptionTier: "pro", status: "authorized" };

test("temporary failures allow two batches, 30 minutes apart, then remain paused for review", async () => {
  const app = setup();
  let requests = 0;
  const verify = async () => { requests++; throw new policy.SubscriptionVerificationError("temporary"); };
  const first = await app.check(verify);
  assert.equal(requests, 2);
  assert.equal(first.subscriptionTier, "pro");
  assert.equal(first.verification.showNotice, true);
  assert.ok(first.verification.retryAt);
  const repeated = await app.check(verify);
  assert.equal(repeated.verification.showNotice, false);
  assert.equal(requests, 2);
  app.advance(30 * 60_000 - 1);
  await app.check(verify);
  assert.equal(requests, 2);
  app.advance(2);
  const exhausted = await app.check(verify);
  assert.equal(requests, 4);
  assert.equal(exhausted.verification.needsReview, true);
  assert.equal(exhausted.verification.retryAt, null);
  app.advance(365 * 24 * 60 * 60_000);
  assert.equal((await app.check(verify)).verification.showNotice, false);
  assert.equal(requests, 4);
  assert.equal(app.business.subscription_tier, "pro");
});

test("a successful retry clears the pause and returns the verified result", async () => {
  const app = setup();
  let requests = 0;
  const result = await app.check(async () => { if (++requests === 1) throw new policy.SubscriptionVerificationError("temporary"); return success; });
  assert.equal(requests, 2);
  assert.deepEqual(result, success);
  await app.check(async () => { requests++; return success; });
  assert.equal(requests, 3);
});

for (const reason of ["not_found", "permission"]) {
  test(`${reason} pauses only that reference for review after one request and preserves access`, async () => {
    const app = setup();
    let requests = 0;
    const verify = async () => { requests++; throw new policy.SubscriptionVerificationError(reason); };
    const first = await app.check(verify);
    assert.equal(requests, 1);
    assert.equal(first.subscriptionTier, "pro");
    assert.equal(first.verification.reason, reason);
    assert.equal(first.verification.showNotice, reason !== "not_found");
    app.advance(365 * 24 * 60 * 60_000);
    assert.equal((await app.check(verify)).verification.showNotice, false);
    assert.equal(requests, 1);
    assert.deepEqual(await app.check(async () => success, "subscription:new"), success);
  });
}

test("simultaneous requests share one verification lease", async () => {
  const app = setup();
  let complete, requests = 0;
  const waiting = app.check(() => { requests++; return new Promise((resolve) => { complete = resolve; }); });
  await new Promise((resolve) => setImmediate(resolve));
  const second = await app.check(async () => { requests++; return success; });
  assert.equal(second.status, "verification_deferred");
  assert.equal(second.verification.showNotice, false);
  assert.equal(requests, 1);
  complete(success);
  assert.deepEqual(await waiting, success);
});

test("database and unexpected application errors are not treated as provider failures", async () => {
  const app = setup();
  await assert.rejects(app.check(async () => { throw new Error("Database unavailable"); }), /Database unavailable/);
  assert.deepEqual(await app.check(async () => success), success);
});

test("provider failures are classified without exposing technical or sensitive provider messages", () => {
  for (const [status, reason] of [[404, "not_found"], [401, "permission"], [403, "permission"], [429, "temporary"], [500, "temporary"], [503, "temporary"]]) {
    assert.equal(policy.classifySubscriptionVerificationFailure(status, "private provider details"), reason);
    assert.doesNotMatch(new policy.SubscriptionVerificationError(reason).message, /private|caller|authorized/);
  }
  assert.equal(policy.classifySubscriptionVerificationFailure(400, "the preapprovalId is not valid for callerId"), "permission");
  assert.equal(policy.parseSubscriptionVerificationNotice({ reason: "unexpected", showNotice: true }), undefined);
  assert.deepEqual(policy.parseSubscriptionVerificationNotice({ reason: "permission", showNotice: false, retryAt: null, private: "secret" }), { reason: "permission", showNotice: false, retryAt: null });
});

test("status API returns a quiet deferred result without loading purchases or leaking provider errors", async () => {
  let verified = 0;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "owner", email: "owner@example.test" } } }) },
    from(table) {
      assert.equal(table, "business_memberships");
      return { select() { return this; }, eq() { return this; }, limit() { return this; }, maybeSingle: async () => ({ data: { role: "owner" } }) };
    }
  };
  const route = load("src/app/api/subscription/status/route.ts", {
    "next/server": { NextResponse: { json: (data, options) => ({ data, status: options?.status ?? 200 }) } },
    "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => db },
    "@/lib/mercadopago/subscriptions": { verifyBusinessSubscriptionStatus: async () => { verified++; return { ...success, status: "verification_deferred", verification: { reason: "permission", retryAt: null, showNotice: false } }; } }
  });
  const response = await route.GET({ nextUrl: new URL("https://example.test/api/subscription/status?businessId=business"), headers: new Headers({ authorization: "Bearer test" }) });
  assert.equal(response.status, 200);
  assert.equal(response.data.subscriptionTier, "pro");
  assert.equal(response.data.purchase, null);
  assert.equal(response.data.verification.showNotice, false);
  assert.equal(response.data.error, undefined);
  assert.equal(verified, 1);
});

test("client mapping preserves structured verification state and discards unexpected provider fields", async () => {
  const previousFetch = global.fetch;
  try {
    global.fetch = async () => Response.json({ subscriptionTier: "pro", status: "verification_deferred", verification: { reason: "permission", showNotice: false, retryAt: null, message: "technical provider text" } });
    const endpoint = load("src/lib/networking/endpoints/subscription.ts", { "@/lib/networking/endpoints/auth": { getAccessToken: async () => "local-test-token" } });
    const result = await endpoint.syncProSubscriptionStatus("business");
    assert.deepEqual(result.verification, { reason: "permission", retryAt: null, showNotice: false });
    assert.doesNotMatch(JSON.stringify(result), /technical provider text/);
  } finally { global.fetch = previousFetch; }
});
