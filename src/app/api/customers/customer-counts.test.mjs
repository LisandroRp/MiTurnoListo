import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as customerList from "../../../features/scheduling/utils/customer-list.ts";

const require = createRequire(import.meta.url);

test("new customer totals match the tag filter across all source pages and exclude at-risk customers", async () => {
  const now = new Date().toISOString();
  const rows = Array.from({ length: 104 }, (_, index) => ({
    id: String(index), full_name: `Customer ${index}`, booking_count: index < 100 ? 3 : index === 103 ? 21 : index === 101 ? 2 : 1,
    last_booked_at: index === 102 ? "2020-01-01T00:00:00Z" : now, total_customers: 104
  }));
  const queries = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) },
    from: () => {
      const query = { select: () => query, eq: () => query, limit: () => query, maybeSingle: async () => ({ data: { role: "owner" }, error: null }) };
      return query;
    },
    rpc: async (_, options) => {
      queries.push(options);
      return { data: rows.slice((options.page_number - 1) * options.page_size, options.page_number * options.page_size), error: null };
    }
  };
  const url = new URL("./route.ts", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  const modules = {
    "next/server": { NextResponse: { json: (payload, options) => ({ payload, status: options?.status ?? 200 }) } },
    "@/features/scheduling/utils/customer-list": customerList,
    "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => db },
    "@/lib/networking/api-errors": { createApiErrorResponse: () => { throw new Error("Unexpected API error"); } }
  };
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, url.pathname);
  async function request(extra = "") {
    return loaded.exports.GET({ nextUrl: { searchParams: new URLSearchParams(`businessId=business&page=1&perPage=10${extra}`) }, headers: new Headers({ authorization: "Bearer token" }) });
  }
  const all = await request();
  assert.equal(all.payload.meta.newCustomers, 2);
  assert.equal(all.payload.data.length, 10);
  assert.equal(all.payload.meta.totalCustomers, 104);
  assert.deepEqual(queries.map((query) => query.page_number), [1, 2]);
  const filtered = await request("&tag=new");
  assert.equal(filtered.payload.meta.newCustomers, 2);
  assert.equal(filtered.payload.meta.totalCustomers, 2);
  assert.deepEqual(filtered.payload.data.map((customer) => customer.id), ["100", "101"]);
  const risk = await request("&tag=atRisk");
  assert.equal(risk.payload.meta.newCustomers, 0);
  assert.equal(risk.payload.meta.totalCustomers, 1);
  assert.ok(queries.every((query) => query.target_business_id === "business"));
});
