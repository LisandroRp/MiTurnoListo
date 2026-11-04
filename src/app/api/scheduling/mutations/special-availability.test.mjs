import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const openingId = "10000000-0000-4000-8000-000000000001";
function setup({ role = "owner", fail = false } = {}) {
  const saves = [], deletes = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from(table) {
      const filters = [];
      const query = {
        select: () => query, limit: () => query, eq: (key, value) => { filters.push([key, value]); return query; },
        maybeSingle: async () => ({ data: table === "business_memberships" ? { role } : { subscription_tier: "pro", timezone: "UTC" } }),
        delete: () => query,
        then(resolve, reject) { deletes.push({ table, filters }); return Promise.resolve({ error: null }).then(resolve, reject); }
      };
      return query;
    }
  };
  const modules = {
    "next/server": { NextResponse: { json: (data, options) => ({ data, status: options?.status ?? 200 }) } },
    "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => db },
    "@/lib/special-availability": { saveSpecialAvailability: async (...args) => { if (fail) throw new Error("SPECIAL_AVAILABILITY:Conflict"); saves.push(args); } },
    "@/lib/referrals": { reconcileExpiredReferralTierForBusiness: async () => "pro" },
    "@/lib/slugs": { isUuid: (value) => value === openingId },
    "@/lib/networking/api-errors": { getSafeErrorMessage: (error) => error.message, createApiErrorResponse: (error, options) => ({ data: { error }, status: options.status }) }
  };
  const url = new URL("./route.ts", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? (name.startsWith("@/") ? {} : require(name));
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  return { saves, deletes, request: (action, authorized = true) => loaded.exports.POST({ headers: new Headers(authorized ? { authorization: "Bearer token" } : {}), json: async () => ({ businessId: "business", openingId, opening: { id: openingId }, action }) }) };
}

test("exceptional availability writes require an authenticated owner or admin", async () => {
  const app = setup();
  assert.equal((await app.request("saveSpecialAvailability", false)).status, 401);
  assert.equal(app.saves.length, 0);
  const member = setup({ role: "member" });
  assert.equal((await member.request("saveSpecialAvailability")).status, 403);
  assert.equal(member.saves.length, 0);
  const admin = setup({ role: "admin" });
  assert.equal((await admin.request("saveSpecialAvailability")).status, 200);
  assert.equal(admin.saves[0][1], "business");
  assert.equal(admin.saves[0][3], "UTC");
});

test("opening deletion is scoped to its business and conflicting saves return a useful response", async () => {
  const app = setup();
  assert.equal((await app.request("deleteSpecialAvailability")).status, 200);
  assert.deepEqual(app.deletes, [{ table: "service_special_availability", filters: [["business_id", "business"], ["id", openingId]] }]);
  const conflict = setup({ fail: true });
  const response = await conflict.request("saveSpecialAvailability");
  assert.equal(response.status, 409);
  assert.equal(response.data.error, "Conflict");
});

test("public booking loading, creation and rescheduling all load dated openings before checking slots", () => {
  const publicRoute = readFileSync(new URL("../../public-booking/[serviceId]/route.ts", import.meta.url), "utf8");
  assert.equal((publicRoute.match(/await loadSpecialAvailability\(supabase,/g) ?? []).length, 2);
  const mutationRoute = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
  assert.match(mutationRoute, /await loadSpecialAvailability\(supabase, businessId, appointment.service_id\)/);
  const provider = readFileSync(new URL("../../../../features/scheduling/components/SchedulingProvider.tsx", import.meta.url), "utf8");
  assert.match(provider, /saveSpecialAvailabilityRequest\(businessId, opening\)/);
  assert.match(provider, /deleteSpecialAvailabilityRequest\(businessId, openingId\)/);
});
