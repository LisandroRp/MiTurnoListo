import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";

import ts from "typescript";

const require = createRequire(import.meta.url);
const fileUrl = new URL("./referrals.ts", import.meta.url);
const output = ts.transpileModule(readFileSync(fileUrl, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: fileUrl.pathname
}).outputText;
const referralsModule = new Module(fileUrl.pathname);
referralsModule.filename = fileUrl.pathname;
referralsModule.require = (specifier) => {
  if (specifier === "server-only") return {};
  if (specifier === "@/lib/referral-rules") return { normalizeReferralCode: (value) => value?.trim().toUpperCase() ?? "" };
  return require(specifier);
};
referralsModule._compile(output, fileUrl.pathname);

const {
  activateReferralRewardForUser,
  getReferralSummary,
  reconcileExpiredReferralTierForBusiness,
  reconcileReferralAccessForUser,
  rewardReferralForBusinessPayment
} = referralsModule.exports;

function createSupabase(overrides = {}, options = {}) {
  const rows = {
    business_memberships: [
      { business_id: "business-1", role: "owner", user_id: "referrer" },
      { business_id: "business-2", role: "owner", user_id: "referred" }
    ],
    businesses: [
      { id: "business-1", subscription_tier: "free" },
      { id: "business-2", subscription_tier: "pro" }
    ],
    business_subscriptions: [],
    business_subscription_payments: [
      { business_id: "business-2", provider: "mercadopago", provider_payment_id: "payment-1", provider_status: "approved" }
    ],
    referral_rewards: [],
    referrals: [
      { id: "referral-1", referred_user_id: "referred", referrer_user_id: "referrer", status: "pending" }
    ],
    user_profiles: [
      { id: "referrer", referral_code: "ABC123", referral_program_activated_at: "2026-01-01T00:00:00Z" }
    ],
    ...overrides
  };

  return {
    rows,
    from(table) {
      const filters = [];
      let action = "select";
      let payload;
      let selected = true;
      let count = false;
      let head = false;
      let order;
      let limit;

      function run(single) {
        if (options.failRewardActivation && table === "referral_rewards" && action === "update" && payload.status === "active") {
          return { count: null, data: null, error: new Error("Reward update failed") };
        }

        let matching = rows[table].filter((row) => filters.every((filter) => filter(row)));

        if (order) {
          matching = [...matching].sort((left, right) => String(left[order.key]).localeCompare(String(right[order.key])) * (order.ascending ? 1 : -1));
        }
        if (limit !== undefined) matching = matching.slice(0, limit);

        const matchCount = matching.length;
        if (action === "update") {
          for (const row of matching) Object.assign(row, payload);
        }

        return {
          count: count ? matchCount : null,
          data: head || (action === "update" && !selected) ? null : single ? (matching[0] ?? null) : matching,
          error: null
        };
      }

      const query = {
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        neq(key, value) { filters.push((row) => row[key] !== value); return this; },
        gt(key, value) { filters.push((row) => row[key] > value); return this; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
        is(key, value) { filters.push((row) => row[key] === value); return this; },
        order(key, options) { order = { key, ascending: options.ascending }; return this; },
        limit(value) { limit = value; return this; },
        select(_columns, options = {}) {
          selected = true;
          count = options.count === "exact";
          head = options.head === true;
          return this;
        },
        update(value) { action = "update"; payload = value; selected = false; return this; },
        insert(value) { rows[table].push(value); return Promise.resolve({ error: null }); },
        maybeSingle() { return Promise.resolve(run(true)); },
        then(resolve, reject) { return Promise.resolve(run(false)).then(resolve, reject); }
      };

      return query;
    }
  };
}

function reward(id, status = "available", daysRemaining = 30, expiresAt = null) {
  return {
    id,
    user_id: "referrer",
    days_granted: 30,
    days_remaining: daysRemaining,
    created_at: id,
    expires_at: expiresAt,
    status
  };
}

test("an approved referred payment saves a reward without turning on PRO", async () => {
  const supabase = createSupabase();

  assert.equal(await rewardReferralForBusinessPayment({
    businessId: "business-2",
    paymentId: "payment-1",
    paymentStatus: "approved",
    supabase
  }), true);
  assert.equal(supabase.rows.referral_rewards[0].status, "available");
  assert.equal(supabase.rows.referral_rewards[0].activated_at, null);
  assert.equal(supabase.rows.businesses[0].subscription_tier, "free");
});

test("each available reward needs a separate activation after the previous one expires", async () => {
  const supabase = createSupabase({ referral_rewards: [reward("reward-1"), reward("reward-2")] });

  await reconcileReferralAccessForUser({ supabase, userId: "referrer" });
  assert.equal(supabase.rows.businesses[0].subscription_tier, "free");
  assert.deepEqual(supabase.rows.referral_rewards.map((item) => item.status), ["available", "available"]);

  const firstSummary = await activateReferralRewardForUser({ origin: "https://example.com", supabase, userId: "referrer" });
  assert.equal(firstSummary.subscriptionAccessSource, "referral");
  assert.equal(firstSummary.availableRewardCount, 1);
  assert.equal(supabase.rows.businesses[0].subscription_tier, "pro");
  assert.deepEqual(supabase.rows.referral_rewards.map((item) => item.status), ["active", "available"]);

  await assert.rejects(
    activateReferralRewardForUser({ origin: "https://example.com", supabase, userId: "referrer" }),
    /cuando tu plan es Free/
  );
  supabase.rows.referral_rewards[0].expires_at = "2020-01-01T00:00:00Z";
  await reconcileReferralAccessForUser({ supabase, userId: "referrer" });

  assert.equal(supabase.rows.businesses[0].subscription_tier, "free");
  assert.deepEqual(supabase.rows.referral_rewards.map((item) => item.status), ["used", "available"]);
  const secondSummary = await activateReferralRewardForUser({ origin: "https://example.com", supabase, userId: "referrer" });
  assert.equal(secondSummary.subscriptionAccessSource, "referral");
  assert.deepEqual(supabase.rows.referral_rewards.map((item) => item.status), ["used", "active"]);
});

test("paid or manually enabled PRO cannot consume a referral reward", async () => {
  const supabase = createSupabase({ referral_rewards: [reward("reward-1")] });
  supabase.rows.businesses[0].subscription_tier = "pro";

  await assert.rejects(
    activateReferralRewardForUser({ origin: "https://example.com", supabase, userId: "referrer" }),
    /cuando tu plan es Free/
  );
  supabase.rows.businesses[0].subscription_tier = "free";
  supabase.rows.business_subscriptions.push({
    business_id: "business-1",
    id: "subscription-1",
    provider: "mercadopago",
    provider_status: "authorized",
    subscription_tier: "pro"
  });

  await assert.rejects(
    activateReferralRewardForUser({ origin: "https://example.com", supabase, userId: "referrer" }),
    /cuando tu plan es Free/
  );
  assert.equal(supabase.rows.referral_rewards[0].status, "available");
});

test("concurrent activation attempts consume only one saved reward", async () => {
  const supabase = createSupabase({ referral_rewards: [reward("reward-1"), reward("reward-2")] });
  const results = await Promise.allSettled([
    activateReferralRewardForUser({ origin: "https://example.com", supabase, userId: "referrer" }),
    activateReferralRewardForUser({ origin: "https://example.com", supabase, userId: "referrer" })
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.deepEqual(supabase.rows.referral_rewards.map((item) => item.status), ["active", "available"]);
});

test("a non-owner cannot upgrade a business with referral rewards", async () => {
  const supabase = createSupabase({ referral_rewards: [reward("reward-1")] });
  supabase.rows.business_memberships[0].role = "admin";

  await assert.rejects(
    activateReferralRewardForUser({ origin: "https://example.com", supabase, userId: "referrer" }),
    /cuenta propietaria/
  );
  assert.equal(supabase.rows.businesses[0].subscription_tier, "free");
  assert.equal(supabase.rows.referral_rewards[0].status, "available");
});

test("a failed reward claim restores Free without consuming the credit", async () => {
  const supabase = createSupabase({ referral_rewards: [reward("reward-1")] }, { failRewardActivation: true });

  await assert.rejects(
    activateReferralRewardForUser({ origin: "https://example.com", supabase, userId: "referrer" }),
    /No pudimos activar el beneficio/
  );
  assert.equal(supabase.rows.businesses[0].subscription_tier, "free");
  assert.equal(supabase.rows.referral_rewards[0].status, "available");
});

test("a paused partial reward remains available when the paid plan ends", async () => {
  const activeReward = reward("reward-1", "active", 30, new Date(Date.now() + 12 * 86400000).toISOString());
  const supabase = createSupabase({ referral_rewards: [activeReward] });
  supabase.rows.businesses[0].subscription_tier = "pro";
  supabase.rows.business_subscriptions.push({
    business_id: "business-1",
    id: "subscription-1",
    provider: "mercadopago",
    provider_status: "authorized",
    subscription_tier: "pro"
  });

  await reconcileReferralAccessForUser({ supabase, userId: "referrer" });
  assert.equal(activeReward.status, "available");
  assert.equal(activeReward.days_remaining, 12);
  supabase.rows.business_subscriptions.length = 0;
  supabase.rows.businesses[0].subscription_tier = "free";

  const summary = await getReferralSummary({ origin: "https://example.com", supabase, userId: "referrer" });
  assert.equal(summary.availableRewardCount, 1);
  assert.equal(summary.availableDays, 12);
  assert.equal(summary.availableMonths, 0);
  assert.equal(summary.subscriptionAccessSource, "free");
});

test("tier-gated requests expire referral PRO without activating the next reward", async () => {
  const supabase = createSupabase({
    referral_rewards: [reward("reward-1", "active", 30, "2020-01-01T00:00:00Z"), reward("reward-2")]
  });
  supabase.rows.businesses[0].subscription_tier = "pro";

  const tier = await reconcileExpiredReferralTierForBusiness({
    businessId: "business-1",
    subscriptionTier: "pro",
    supabase
  });

  assert.equal(tier, "free");
  assert.deepEqual(supabase.rows.referral_rewards.map((item) => item.status), ["used", "available"]);
});

test("expiring a referral reward never downgrades an authorized paid plan", async () => {
  const supabase = createSupabase({
    referral_rewards: [reward("reward-1", "active", 30, "2020-01-01T00:00:00Z")]
  });
  supabase.rows.businesses[0].subscription_tier = "pro";
  supabase.rows.business_subscriptions.push({
    business_id: "business-1",
    id: "subscription-1",
    provider: "mercadopago",
    provider_status: "authorized",
    subscription_tier: "pro"
  });

  const tier = await reconcileExpiredReferralTierForBusiness({
    businessId: "business-1",
    subscriptionTier: "pro",
    supabase
  });

  assert.equal(tier, "pro");
  assert.equal(supabase.rows.businesses[0].subscription_tier, "pro");
  assert.equal(supabase.rows.referral_rewards[0].status, "used");
});
