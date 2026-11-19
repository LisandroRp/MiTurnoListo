import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "../../..");
function load(relative, mocks, cache = new Map()) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path).exports;
  const loadedModule = new Module(path);
  cache.set(path, loadedModule);
  loadedModule.require = (name) => {
    if (name in mocks) return mocks[name];
    if (name === "server-only") return {};
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`, mocks, cache);
    return require(name);
  };
  loadedModule._compile(ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText, path);
  return loadedModule.exports;
}
function database({ manual = null, fail = false } = {}) {
  const rows = {
    businesses: [{ id: "20000000-0000-0000-0000-000000000001", subscription_tier: manual ?? "free", manual_subscription_tier: manual }],
    business_subscriptions: [],
    business_memberships: [{ business_id: "20000000-0000-0000-0000-000000000001", role: "owner", user_id: "owner" }]
  };
  const client = { rows,
    async rpc(name, { p_business_id: businessId }) {
      assert.equal(name, "reconcile_business_subscription");
      if (fail) return { data: null, error: new Error("Database unavailable") };
      const business = rows.businesses.find((row) => row.id === businessId);
      const tiers = [business.manual_subscription_tier, ...rows.business_subscriptions.filter((row) => row.business_id === businessId && row.provider === "mercadopago" && row.provider_status === "authorized").map((row) => row.subscription_tier)];
      const tier = tiers.includes("unlimited") ? "unlimited" : tiers.includes("pro") ? "pro" : "free";
      business.subscription_tier = tier;
      return { data: tier, error: null };
    }, from(table) {
    const filters = [];
    let operation = "select", payload, max;
    const run = (single = false) => {
      if (fail) return { data: null, error: new Error("Database unavailable") };
      let matches = rows[table].filter((row) => filters.every((filter) => filter(row)));
      if (max) matches = matches.slice(-max);
      if (operation === "insert") { const row = { id: `intent-${rows[table].length}`, ...payload }; rows[table].push(row); matches = [row]; }
      if (operation === "update") matches.forEach((row) => Object.assign(row, payload));
      return { data: single ? matches[0] ?? null : matches, error: null };
    };
    return {
      select() { return this; },
      eq(key, value) { filters.push((row) => row[key] === value); return this; },
      in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
      is(key, value) { filters.push((row) => (row[key] ?? null) === value); return this; },
      not(key, _operation, value) { filters.push((row) => (row[key] ?? null) !== value); return this; },
      order() { return this; }, limit(value) { max = value; return this; },
      insert(value) { operation = "insert"; payload = value; return this; },
      update(value) { operation = "update"; payload = value; return this; },
      single() { return Promise.resolve(run(true)); }, maybeSingle() { return Promise.resolve(run(true)); },
      then(onSuccess, onError) { return Promise.resolve(run()).then(onSuccess, onError); }
    };
  } };
  return client;
}
function integration(db) {
  return load("src/lib/mercadopago/subscriptions.ts", {
    "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => db },
    "@/lib/mercadopago/checkout": { getMercadoPagoPublicOrigin: () => "https://example.test" },
    "@/lib/referrals": { reconcileReferralAccessForBusiness: async () => {}, rewardReferralForBusinessPayment: async () => {} }
  });
}

test("both checkouts send the selected server price and persist their distinct plan codes", async () => {
  const previousFetch = global.fetch;
  const previousToken = process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN;
  const previousWebhook = process.env.MP_WEBHOOK_TOKEN;
  process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN = "local-test-token";
  process.env.MP_WEBHOOK_TOKEN = "local-webhook-token";
  try {
    for (const [plan, amount] of [["pro", 25000], ["unlimited", 55000]]) {
      const db = database();
      let request;
      global.fetch = async (_url, init) => {
        request = JSON.parse(init.body);
        return Response.json({ id: "provider-1", external_reference: request.external_reference, status: "pending", init_point: "https://example.test/checkout" });
      };
      const result = await integration(db).createProSubscriptionCheckout({ businessId: db.rows.businesses[0].id, payerEmail: "payer@example.test", requestOrigin: "https://example.test", userId: "owner", plan });
      assert.equal(request.auto_recurring.transaction_amount, amount);
      assert.equal(request.auto_recurring.currency_id, "ARS");
      assert.equal(request.auto_recurring.frequency, 1);
      assert.match(request.external_reference, new RegExp(`\\|p:${plan}$`));
      assert.equal(db.rows.business_subscriptions[0].provider_plan_id, `miturnolisto-${plan}`);
      assert.equal(db.rows.business_subscriptions[0].subscription_tier, "free");
      assert.equal(result.checkoutUrl, "https://example.test/checkout");
    }
  } finally {
    global.fetch = previousFetch;
    if (previousWebhook === undefined) delete process.env.MP_WEBHOOK_TOKEN; else process.env.MP_WEBHOOK_TOKEN = previousWebhook;
    if (previousToken === undefined) delete process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN; else process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN = previousToken;
  }
});

test("provider synchronization activates Unlimited and preserves manual access after cancellation", async () => {
  const previousFetch = global.fetch, previousToken = process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN;
  process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN = "local-test-token";
  try {
    const db = database({ manual: "unlimited" });
    const id = db.rows.businesses[0].id;
    db.rows.business_subscriptions.push({ id: "stored", business_id: id, provider: "mercadopago", provider_subscription_id: "provider-1", provider_plan_id: "miturnolisto-unlimited", provider_status: "authorized", subscription_tier: "unlimited" });
    const service = integration(db);
    global.fetch = async () => Response.json({ id: "provider-1", external_reference: `mtl|b:${id}|u:owner|i:stored|p:unlimited`, status: "authorized" });
    assert.equal((await service.syncSubscriptionTierByPreapprovalId("provider-1")).subscriptionTier, "unlimited");
    // A later response without external_reference must retain the stored Unlimited plan.
    global.fetch = async () => Response.json({ id: "provider-1", status: "authorized" });
    await service.syncSubscriptionTierByPreapprovalId("provider-1");
    assert.equal(db.rows.business_subscriptions[0].provider_plan_id, "miturnolisto-unlimited");
    global.fetch = async () => Response.json({ id: "provider-1", status: "cancelled" });
    const result = await service.syncSubscriptionTierByPreapprovalId("provider-1");
    assert.equal(result.subscriptionTier, "unlimited");
    assert.equal(db.rows.business_subscriptions[0].subscription_tier, "free");
  } finally {
    global.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN; else process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN = previousToken;
  }
});

test("a business cannot synchronize or invalidate another business subscription", async () => {
  const previousFetch = global.fetch, previousToken = process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN;
  process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN = "local-test-token";
  try {
    const db = database();
    const service = integration(db);
    global.fetch = async () => Response.json({ id: "foreign", external_reference: "mtl|b:30000000-0000-0000-0000-000000000001|u:other|i:other|p:pro", status: "authorized" });
    await assert.rejects(service.syncBusinessSubscriptionByPreapprovalId({ businessId: db.rows.businesses[0].id, preapprovalId: "foreign" }), /does not belong/);
    assert.equal(db.rows.businesses[0].subscription_tier, "free");
    assert.equal(db.rows.business_subscriptions.length, 0);
  } finally {
    global.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN; else process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN = previousToken;
  }
});

test("reconciliation honors all authorized subscriptions and fails closed on database errors", async () => {
  const db = database();
  const service = load("src/lib/subscription-entitlements.ts", {});
  db.rows.business_subscriptions.push({ business_id: db.rows.businesses[0].id, provider: "mercadopago", provider_status: "authorized", subscription_tier: "unlimited" });
  assert.equal(await service.reconcileSubscriptionEntitlement(db, db.rows.businesses[0].id), "unlimited");
  await assert.rejects(service.reconcileSubscriptionEntitlement(database({ fail: true }), db.rows.businesses[0].id), /Unable to reconcile/);
});

test("upgrading an existing monthly authorization updates the same subscription without a second checkout", async () => {
  const previousFetch = global.fetch, previousToken = process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN;
  process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN = "local-test-token";
  try {
    const db = database();
    const id = db.rows.businesses[0].id;
    db.rows.business_subscriptions.push({ id: "stored", business_id: id, provider: "mercadopago", provider_subscription_id: "provider-1", provider_plan_id: "miturnolisto-pro", provider_status: "authorized", subscription_tier: "pro", started_at: "2026-01-01T00:00:00Z" });
    const calls = [];
    global.fetch = async (url, init) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(init.body) : null });
      return Response.json({ id: "provider-1", status: "authorized", external_reference: `mtl|b:${id}|u:owner|i:stored|p:pro` });
    };
    const result = await integration(db).changeBusinessSubscriptionPlan({ businessId: id, preapprovalId: "provider-1", plan: "unlimited" });
    assert.equal(result.subscriptionTier, "unlimited");
    assert.deepEqual(calls.map(({ method }) => method), ["GET", "PUT"]);
    assert.equal(calls[1].body.auto_recurring.transaction_amount, 55000);
    assert.match(calls[1].body.external_reference, /\|p:unlimited$/);
    assert.equal(db.rows.business_subscriptions.length, 1);
    assert.equal(db.rows.business_subscriptions[0].provider_subscription_id, "provider-1");
    assert.equal(db.rows.business_subscriptions[0].started_at, "2026-01-01T00:00:00Z");
  } finally {
    global.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN; else process.env.MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN = previousToken;
  }
});

test("checkout API rejects unsupported tiers and dispatches the chosen plan after authorization", async () => {
  const previousFlag = process.env.NEXT_PUBLIC_SUBSCRIPTION_PLANS_V2_ENABLED;
  try {
    const db = database();
    db.auth = { getUser: async () => ({ data: { user: { id: "owner", email: "owner@example.test" } }, error: null }) };
    const calls = [];
    const route = load("src/app/api/subscription/checkout/route.ts", {
      "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => db },
      "@/lib/mercadopago/subscriptions": {
        syncLatestBusinessSubscription: async () => ({ subscriptionTier: "free", status: "none", preapprovalId: "" }),
        createProSubscriptionCheckout: async (input) => { calls.push(input); return { checkoutUrl: "https://example.test/checkout", status: "pending" }; }
      }
    });
    const { NextRequest } = require("next/server");
    const request = (plan) => new NextRequest("https://example.test/api/subscription/checkout", { method: "POST", headers: { Authorization: "Bearer local-test", "Content-Type": "application/json" }, body: JSON.stringify({ businessId: db.rows.businesses[0].id, plan, amount: 1 }) });
    assert.equal((await route.POST(request("unknown"))).status, 400);
    assert.equal(calls.length, 0);
    for (const flag of [undefined, "false", "true"]) {
      if (flag === undefined) delete process.env.NEXT_PUBLIC_SUBSCRIPTION_PLANS_V2_ENABLED;
      else process.env.NEXT_PUBLIC_SUBSCRIPTION_PLANS_V2_ENABLED = flag;
      assert.equal((await route.POST(request("unlimited"))).status, 200);
    }
    assert.equal(calls.length, 3);
    for (const call of calls) {
      assert.equal(call.plan, "unlimited");
      assert.equal(call.amount, undefined);
    }
  } finally {
    if (previousFlag === undefined) delete process.env.NEXT_PUBLIC_SUBSCRIPTION_PLANS_V2_ENABLED; else process.env.NEXT_PUBLIC_SUBSCRIPTION_PLANS_V2_ENABLED = previousFlag;
  }
});

test("webhook authentication fails closed and failed synchronization remains retryable", async () => {
  const previous = process.env.MP_WEBHOOK_TOKEN;
  try {
    let syncCalls = 0;
    const route = load("src/app/api/mercadopago/subscription-webhook/route.ts", {
      "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => ({ from: () => ({ insert: () => Promise.resolve({ error: null }) }) }) },
      "@/lib/mercadopago/subscriptions": {
        syncSubscriptionTierByPreapprovalId: async () => { syncCalls += 1; throw new Error("Provider unavailable"); },
        syncSubscriptionPaymentByPaymentId: async () => {}
      }
    });
    const { NextRequest } = require("next/server");
    const request = (token = "") => new NextRequest(`https://example.test/api/mercadopago/subscription-webhook?token=${token}`, { method: "POST", body: JSON.stringify({ type: "subscription_preapproval", data: { id: "provider-1" } }) });
    delete process.env.MP_WEBHOOK_TOKEN;
    assert.equal((await route.POST(request())).status, 503);
    process.env.MP_WEBHOOK_TOKEN = "local-test-token";
    assert.equal((await route.POST(request("wrong"))).status, 401);
    assert.equal(syncCalls, 0);
    assert.equal((await route.POST(request("local-test-token"))).status, 503);
    assert.equal(syncCalls, 1);
  } finally {
    if (previous === undefined) delete process.env.MP_WEBHOOK_TOKEN; else process.env.MP_WEBHOOK_TOKEN = previous;
  }
});

test("manual Unlimited activation is authorized as super admin and delegated to the audited atomic RPC", async () => {
  const db = database();
  db.rows.super_admins = [{ user_id: "owner" }];
  db.auth = { getUser: async () => ({ data: { user: { id: "owner", email: "admin@example.test" } }, error: null }) };
  const calls = [];
  db.rpc = async (name, args) => { calls.push({ name, args }); return { data: null, error: null }; };
  const route = load("src/app/api/super-admin/businesses/route.ts", {
    "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => db }
  });
  const { NextRequest } = require("next/server");
  const request = () => new NextRequest("https://example.test/api/super-admin/businesses", { method: "POST", headers: { Authorization: "Bearer local-test", "Content-Type": "application/json" }, body: JSON.stringify({ businessId: db.rows.businesses[0].id, action: "activateUnlimited" }) });
  assert.equal((await route.POST(request())).status, 200);
  assert.equal(calls[0].name, "set_manual_business_plan");
  assert.equal(calls[0].args.p_tier, "unlimited");
  assert.equal(calls[0].args.p_actor_email, "admin@example.test");
  assert.equal(db.rows.businesses[0].subscription_tier, "free");
  db.rows.super_admins = [];
  assert.equal((await route.POST(request())).status, 403);
  assert.equal(calls.length, 1);
});
