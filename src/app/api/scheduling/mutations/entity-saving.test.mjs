import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as planLimits from "../../../../features/scheduling/plan-limits.ts";
import * as numericLimits from "../../../../features/scheduling/service-numeric-limits.ts";
import * as slugs from "../../../../lib/slugs.ts";

const require = createRequire(import.meta.url);
const next = { NextResponse: { json: (data, options) => ({ data, status: options?.status ?? 200 }) } };
function load(relative, mocks = {}) {
  const url = new URL(relative, import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => mocks[name] ?? (name.startsWith("@/") || name === "server-only" ? {} : require(name));
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  return loaded.exports;
}
const apiErrors = load("../../../../lib/networking/api-errors.ts", { "next/server": next });
const service = { id: "new-service", name: "Prueba", description: "", price: 1000, deposit: 100, durationMinutes: 90, capacity: 1, reservationLeadMinutes: 0, cancellationLeadMinutes: 0, paymentMethod: "cash", schedule: {}, employeeIds: [], addons: [], customFields: [] };
function setup({ rows = [], dbError = null, readError = null, failTable = "services", failOperation = "upsert", tier = "pro", limitsEnabled = true } = {}) {
  const writes = [], reads = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from(table) {
      const filters = [];
      let operation;
      let single = false;
      const query = {
        select: () => query, limit: () => query, maybeSingle: () => { single = true; return query; },
        eq: (key, value) => { filters.push([key, value]); return query; },
        neq: (key, value) => { filters.push([`not:${key}`, value]); return query; },
        ilike: (key, value) => { filters.push([`ilike:${key}`, value]); return query; },
        upsert: (values) => { operation = "upsert"; writes.push({ table, operation, values }); return query; },
        delete: () => { operation = "delete"; writes.push({ table, operation }); return query; },
        insert: (values) => { operation = "insert"; writes.push({ table, operation, values }); return query; },
        then(resolve, reject) {
          reads.push({ table, filters });
          if (operation) return Promise.resolve({ error: table === failTable && operation === failOperation ? dbError : null }).then(resolve, reject);
          if (table === "business_memberships") return Promise.resolve({ data: { role: "owner" } }).then(resolve, reject);
          if (table === "businesses") return Promise.resolve({ data: { subscription_tier: tier, pro_limits_enabled: limitsEnabled, timezone: "UTC" } }).then(resolve, reject);
          const found = rows.filter((row) => row.table === table && filters.every(([key, value]) => {
            if (key.startsWith("not:")) return row[key.slice(4)] !== value;
            if (key.startsWith("ilike:")) return row[key.slice(6)].toLowerCase() === value.replace(/\\([\\%_])/g, "$1").toLowerCase();
            return row[key] === value;
          }));
          return Promise.resolve({ data: single ? found[0] ?? null : found, error: readError }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  const route = load("./route.ts", {
    "next/server": next,
    "@/lib/networking/api-errors": apiErrors,
    "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => db },
    "@/lib/referrals": { reconcileExpiredReferralTierForBusiness: async () => tier },
    "@/features/scheduling/plan-limits": planLimits,
    "@/features/scheduling/service-numeric-limits": numericLimits,
    "@/lib/slugs": slugs,
    "@/features/scheduling/service-description": { isValidServiceDescription: () => true },
    "@/features/scheduling/service-cancellation-policy": { hasValidCancellationLeadMinutes: () => true },
    "@/features/scheduling/service-custom-fields": { hasValidServiceCustomFields: () => true, normalizeServiceCustomFields: () => [] },
    "@/lib/networking/mappers/scheduling": { mapScheduleToAvailabilityRows: () => [{ starts_at: "09:00", ends_at: "12:00" }] }
  });
  return { writes, reads, save: (action = "saveService", entity = service) => route.POST({ headers: new Headers({ authorization: "Bearer test" }), json: async () => ({ businessId: "business", action, [action === "saveService" ? "service" : "employee"]: entity }) }) };
}

test("duplicate service and employee names return a clear conflict before writing, including archived records", async () => {
  for (const [action, table, label] of [["saveService", "services", "servicio"], ["saveEmployee", "employees", "empleado"]]) {
    const app = setup({ rows: [{ table, id: "existing", business_id: "business", name: "PRUEBA", is_active: false }] });
    const response = await app.save(action, { ...service, name: " Prueba " });
    assert.equal(response.status, 409);
    assert.match(response.data.error, new RegExp(`Ya existe un ${label} con ese nombre`));
    assert.doesNotMatch(response.data.error, /CONFLICT:|Unable/);
    assert.equal(app.writes.length, 0);
  }
});

test("renaming the same record and the same name in another business remain allowed", async () => {
  for (const action of ["saveService", "saveEmployee"]) {
    const table = action === "saveService" ? "services" : "employees";
    const app = setup({ rows: [
      { table, id: service.id, business_id: "business", name: "Prueba", slug: "prueba", public_slug: "prueba" },
      { table, id: "other", business_id: "other-business", name: "Prueba", slug: "prueba", public_slug: "prueba" }
    ] });
    assert.equal((await app.save(action)).status, 200);
    assert.ok(app.writes.length > 0);
  }
});

test("literal wildcard characters in names are escaped for the duplicate lookup", async () => {
  const app = setup();
  assert.equal((await app.save("saveService", { ...service, name: "Promo 10%_" })).status, 200);
  assert.ok(app.reads.some((read) => read.filters.some(([key, value]) => key === "ilike:name" && value === "Promo 10\\%\\_")));
});

test("equivalent service links are rejected before writes and a concurrent unique violation is a conflict", async () => {
  const app = setup({ rows: [{ table: "services", id: "other", business_id: "business", name: "Prueba!", slug: "prueba", public_slug: "prueba" }] });
  assert.equal((await app.save()).status, 409);
  assert.equal(app.writes.length, 0);
  const race = setup({ dbError: { code: "23505", message: 'duplicate key value violates unique constraint "services_business_id_slug_key"' } });
  assert.equal((await race.save()).status, 409);
});

test("database plan limits retain their message and return 402 for services and employees", async () => {
  for (const [action, table] of [["saveService", "services"], ["saveEmployee", "employees"]]) {
    const app = setup({ failTable: table, dbError: { code: "P0001", message: "PLAN_LIMIT:Alcanzaste el límite de tu plan." } });
    const response = await app.save(action);
    assert.equal(response.status, 402);
    assert.equal(response.data.code, "SCHEDULING_PLAN_LIMIT_REACHED");
    assert.equal(response.data.error, "Alcanzaste el límite de tu plan.");
  }
});

test("unexpected database errors expose diagnostic identifiers without row contents or provider hints", async () => {
  const app = setup({ dbError: { code: "23514", message: 'new row violates check constraint "service_price_check"', details: "private customer data", hint: "secret" } });
  const response = await app.save();
  assert.equal(response.status, 500);
  assert.match(response.data.details, /23514.*service_price_check/);
  assert.doesNotMatch(JSON.stringify(response), /private customer data|secret/);
  const schedule = setup({ failTable: "employee_weekly_availability", failOperation: "insert", dbError: { code: "23503", message: "private data" } });
  const failed = await schedule.save("saveEmployee");
  assert.equal(failed.status, 500);
  assert.match(failed.data.error, /schedule/);
  assert.match(failed.data.details, /23503/);
});

test("numeric service limits are enforced by the API before any write", async () => {
  for (const change of [{ price: 10_000_001 }, { deposit: 5_000_001, price: 10_000_000 }, { deposit: 1001 }, { durationMinutes: 301 }]) {
    const app = setup();
    const response = await app.save("saveService", { ...service, ...change });
    assert.equal(response.status, 409);
    assert.match(response.data.error, /300 minutos/);
    assert.equal(app.writes.length, 0);
  }
  assert.equal((await setup().save("saveService", { ...service, price: 10_000_000, deposit: 5_000_000, durationMinutes: 300 })).status, 200);
});


for (const [tier, action, table, maximum] of [["pro", "saveEmployee", "employees", 3], ["pro", "saveService", "services", 10], ["free", "saveEmployee", "employees", 1], ["free", "saveService", "services", 2]]) {
  test(`${tier} ${table} beyond the visibility quota are saved hidden and can still be edited`, async () => {
    const rows = Array.from({ length: maximum }, (_, index) => ({ table, id: `visible-${index}`, name: `Visible ${index}`, business_id: "business", is_active: true, is_public: true }));
    const app = setup({ rows, tier });
    const response = await app.save(action, { ...service, isVisible: true });
    assert.equal(response.status, 200);
    assert.equal(app.writes.find((write) => write.table === table).values.is_public, false);
    const hidden = { table, id: "hidden", name: "Hidden", business_id: "business", is_active: true, is_public: false };
    const edited = setup({ rows: [...rows, hidden], tier });
    assert.equal((await edited.save(action, { ...service, id: "hidden", name: "Hidden", isVisible: false })).status, 200);
  });

  test(`${tier} ${table} activation requires a free visibility slot, while hiding and Infinity remain available`, async () => {
    const rows = Array.from({ length: maximum }, (_, index) => ({ table, id: `visible-${index}`, name: `Visible ${index}`, business_id: "business", is_active: true, is_public: true }));
    rows.push({ table, id: "hidden", name: "Hidden", business_id: "business", is_active: true, is_public: false });
    const full = setup({ rows, tier });
    const rejected = await full.save(action, { ...service, id: "hidden", name: "Hidden", isVisible: true });
    assert.equal(rejected.status, 402);
    assert.match(rejected.data.error, /Ocultá otro/);
    assert.equal(full.writes.length, 0);
    const freed = setup({ rows: rows.map((row) => row.id === "visible-0" ? { ...row, is_public: false } : row), tier });
    assert.equal((await freed.save(action, { ...service, id: "hidden", name: "Hidden", isVisible: true })).status, 200);
    assert.equal(freed.writes.find((write) => write.table === table).values.is_public, true);
    for (const options of [{ tier: "unlimited" }, ...(tier === "pro" ? [{ limitsEnabled: false }] : [])]) {
      const unlimited = setup({ rows, tier, ...options });
      assert.equal((await unlimited.save(action, { ...service, isVisible: true })).status, 200);
      assert.equal(unlimited.writes.find((write) => write.table === table).values.is_public, true);
    }
  });
}
