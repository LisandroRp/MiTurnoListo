import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import test from "node:test";
import ts from "typescript";

const fileUrl = new URL("./scheduling.ts", import.meta.url);
const output = ts.transpileModule(readFileSync(fileUrl, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function createSnapshotLoader(tables, failedTable) {
  const queries = [];
  const database = {
    auth: { getUser: async () => ({ data: { user: { id: "owner", email: "owner@example.com" } }, error: null }) },
    from(table) {
      const filters = [];
      let single = false;
      const query = {
        select() { return query; },
        eq(column, value) { filters.push([column, [value]]); return query; },
        in(column, values) { filters.push([column, values]); return query; },
        limit() { return query; },
        order() { return query; },
        single() { single = true; return query; },
        maybeSingle() { single = true; return query; },
        then(resolve, reject) {
          queries.push({ table, filters });
          const rows = (tables[table] ?? []).filter((row) => filters.every(([column, values]) => values.includes(row[column])));
          return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: table === failedTable ? new Error("Database unavailable") : null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  const identity = (rows) => rows;
  const modules = {
    "@/lib/networking/clients/supabase-browser": { getSupabaseBrowserClient: () => database },
    "@/lib/networking/mappers/scheduling": {
      mapEmployees: (employees, availability) => ({ employees, availability }),
      mapServices: (services, employees, availability, addons) => ({ services, employees, availability, addons }),
      mapAppointments: identity,
      mapBusinessDayBlocks: identity,
      mapProfile: () => ({}),
      buildDashboardMetrics: () => [],
      getDefaultFocusedDate: () => "2026-10-20",
      themeOptions: ["coral"]
    },
    "@/lib/networking/endpoints/payment-settings": { getPaymentSettings: async () => ({}) }
  };
  const loaded = new Module(fileUrl.pathname);
  loaded.filename = fileUrl.pathname;
  loaded.require = (specifier) => modules[specifier] ?? {};
  loaded._compile(output, fileUrl.pathname);
  return { load: loaded.exports.loadSchedulingSnapshot, queries };
}

const workspace = {
  business_memberships: [{ user_id: "owner", business_id: "business", locale: "es", theme: "coral" }],
  user_profiles: [{ id: "owner" }],
  businesses: [{ id: "business", timezone: "UTC" }]
};

test("workspace relations are restricted to the current business employees and services", async () => {
  const { load, queries } = createSnapshotLoader({
    ...workspace,
    employees: [{ id: "employee", business_id: "business" }, { id: "other-employee", business_id: "other" }],
    services: [{ id: "service", business_id: "business" }, { id: "other-service", business_id: "other" }],
    employee_weekly_availability: [{ employee_id: "employee" }, { employee_id: "other-employee" }],
    service_employees: [{ service_id: "service", employee_id: "employee" }, { service_id: "other-service", employee_id: "other-employee" }],
    service_weekly_availability: [{ service_id: "service" }, { service_id: "other-service" }],
    service_addons: [{ service_id: "service" }, { service_id: "other-service" }]
  });
  const snapshot = await load({ scope: "services" });
  assert.deepEqual(snapshot.employees.availability, [{ employee_id: "employee" }]);
  assert.deepEqual(snapshot.services.employees, [{ service_id: "service", employee_id: "employee" }]);
  assert.deepEqual(snapshot.services.availability, [{ service_id: "service" }]);
  assert.deepEqual(snapshot.services.addons, [{ service_id: "service" }]);
  for (const table of ["employee_weekly_availability", "service_employees", "service_weekly_availability", "service_addons"]) {
    assert.equal(queries.filter((query) => query.table === table).length, 1);
    assert.equal(queries.find((query) => query.table === table).filters.length, 1);
  }
  assert.equal(queries.filter((query) => query.table === "employees").length, 1);
  assert.equal(queries.filter((query) => query.table === "services").length, 1);
});

test("empty workspaces skip relation queries instead of reading whole tables", async () => {
  const { load, queries } = createSnapshotLoader(workspace);
  const snapshot = await load({ scope: "services" });
  assert.deepEqual(snapshot.services.addons, []);
  assert.equal(queries.some((query) => ["employee_weekly_availability", "service_employees", "service_weekly_availability", "service_addons"].includes(query.table)), false);
});

test("failed employee queries do not trigger unbounded availability reads", async () => {
  const { load, queries } = createSnapshotLoader(workspace, "employees");
  await assert.rejects(load({ scope: "personnel" }), /Unable to load the user workspace/);
  assert.equal(queries.some((query) => query.table === "employee_weekly_availability"), false);
});

test("profile loads skip scheduling tables", async () => {
  const { load, queries } = createSnapshotLoader(workspace);
  await load({ scope: "profile" });
  assert.deepEqual(queries.map((query) => query.table).sort(), ["business_memberships", "businesses", "user_profiles"]);
});
