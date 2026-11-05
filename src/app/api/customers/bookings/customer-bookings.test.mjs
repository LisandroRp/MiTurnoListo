import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const businessId = "10000000-0000-0000-0000-000000000001";
const customerId = "20000000-0000-0000-0000-000000000002";
function harness({ authorized = true, member = true, customerExists = true, fail = false } = {}) {
  const queries = [];
  const rows = Array.from({ length: 14 }, (_, i) => ({ id: String(i).padStart(2, "0"), business_id: businessId, customer_id: customerId,
    starts_at: i < 4 ? `2099-01-0${i + 1}T12:00:00Z` : `2020-01-${String(i).padStart(2, "0")}T12:00:00Z`, ends_at: "2099-01-01T13:00:00Z",
    services: { name: "Consultation" }, employees: [{ name: "Professional" }], appointment_status: "scheduled", payment_status: "pending" }));
  rows.push({ ...rows[0], id: "foreign", business_id: "other" }, { ...rows[0], id: "other-customer", customer_id: "other" });
  const db = {
    auth: { getUser: async () => ({ data: { user: authorized ? { id: "owner" } : null }, error: null }) },
    from(table) {
      const state = { table, eqs: [], orders: [] }; queries.push(state);
      const query = {
        select: (fields, options) => { state.fields = fields; state.head = options?.head; return query; },
        eq: (key, value) => { state.eqs.push([key, value]); return query; },
        gte: (_, value) => { state.gte = value; return query; }, lt: (_, value) => { state.lt = value; return query; },
        order: (key, options) => { state.orders.push([key, options.ascending]); return query; },
        range: (from, to) => { state.range = [from, to]; return query; }, limit: () => query,
        maybeSingle: async () => ({ data: table === "business_memberships" ? member ? { role: "owner" } : null : table === "customers" ? customerExists ? { id: customerId } : null : { timezone: "America/Argentina/Buenos_Aires" }, error: null }),
        then(resolve, reject) {
          let data = rows.filter((row) => state.eqs.every(([key, value]) => row[key] === value) && (!state.gte || row.starts_at >= state.gte) && (!state.lt || row.starts_at < state.lt));
          const count = data.length;
          data.sort((a, b) => a.starts_at.localeCompare(b.starts_at) * (state.orders[0]?.[1] ? 1 : -1));
          if (state.range) data = data.slice(state.range[0], state.range[1] + 1);
          return Promise.resolve({ data: state.head ? null : data, count, error: fail ? { message: "private database failure" } : null }).then(resolve, reject);
        }
      }; return query;
    }
  };
  const url = new URL("./route.ts", import.meta.url), loaded = new Module(url.pathname);
  loaded.require = (name) => name === "next/server" ? { NextResponse: { json: (payload, options) => ({ payload, status: options?.status ?? 200, headers: options?.headers }) } }
    : name === "@/lib/networking/clients/supabase-admin" ? { getSupabaseAdminClient: () => db } : require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, url.pathname);
  return { queries, rows, request: (page = 1, token = "Bearer token", id = customerId) => loaded.exports.GET({ nextUrl: { searchParams: new URLSearchParams({ businessId, customerId: id, page: String(page) }) }, headers: new Headers(token ? { authorization: token } : {}) }) };
}

test("history paginates upcoming first then past descending without leaking other customers or businesses", async () => {
  const app = harness();
  const first = await app.request();
  assert.equal(first.status, 200);
  assert.equal(first.headers["Cache-Control"], "private, no-store");
  assert.equal(first.payload.meta.total, 14);
  assert.deepEqual(first.payload.data.map((row) => row.id), ["00", "01", "02", "03", "13", "12", "11", "10", "09", "08"]);
  assert.equal(first.payload.data[0].serviceName, "Consultation");
  assert.equal(first.payload.data[0].employeeName, "Professional");
  assert.equal(first.payload.data[0].isUpcoming, true);
  assert.equal(first.payload.data[4].isUpcoming, false);
  const second = await app.request(2);
  assert.deepEqual(second.payload.data.map((row) => row.id), ["07", "06", "05", "04"]);
  assert.equal((await app.request(99)).payload.meta.currentPage, 2);
  for (const query of app.queries.filter((q) => q.table === "appointments")) {
    assert.deepEqual(query.eqs, [["business_id", businessId], ["customer_id", customerId]]);
    if (!query.head) assert.ok(query.range[1] - query.range[0] < 10);
  }
});

test("history denies unauthorized access, missing customers and malformed requests before reading bookings", async () => {
  for (const [options, expected] of [[{ authorized: false }, 401], [{ member: false }, 403], [{ customerExists: false }, 404]]) {
    const app = harness(options); assert.equal((await app.request()).status, expected);
    assert.ok(!app.queries.some((q) => q.table === "appointments"));
  }
  const app = harness();
  assert.equal((await app.request(1, "")).status, 401);
  assert.equal((await app.request(-1)).status, 400);
  assert.equal((await app.request(1, "Bearer token", "bad-id")).status, 400);
});

test("history handles empty results, missing relations and database errors safely", async () => {
  const empty = harness(); empty.rows.length = 0;
  const result = await empty.request(); assert.deepEqual(result.payload.data, []); assert.equal(result.payload.meta.total, 0);
  const app = harness(); app.rows[0].services = null; app.rows[0].employees = [];
  const response = await app.request(); assert.equal(response.payload.data[0].serviceName, ""); assert.equal(response.payload.data[0].employeeName, "");
  const failed = await harness({ fail: true }).request(); assert.equal(failed.status, 500); assert.ok(!JSON.stringify(failed).includes("private database failure"));
});
