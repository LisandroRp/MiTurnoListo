import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import ts from "typescript";

function loadModule(path, imports = {}) {
  const fileUrl = new URL(path, import.meta.url);
  const output = ts.transpileModule(readFileSync(fileUrl, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const loaded = new Module(fileUrl.pathname);
  loaded.filename = fileUrl.pathname;
  loaded.require = (specifier) => imports[specifier];
  loaded._compile(output, fileUrl.pathname);
  return loaded.exports;
}

const planLimits = loadModule("../../features/scheduling/plan-limits.ts");
const { getPlanPublicAccess } = loadModule("./plan-public-access.ts", {
  "@/features/scheduling/plan-limits": planLimits
});

function createDatabase(tables) {
  const queries = [];
  return {
    queries,
    from(table) {
      const filters = [];
      queries.push({ table, filters });
      const query = {
        select() { return query; },
        eq(column, value) {
          filters.push([column, value]);
          return query;
        },
        then(resolve, reject) {
          const data = (tables[table] ?? []).filter((row) => filters.every(([column, value]) => row[column] === value));
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
}

test("Free public access includes only two visible services and one visible employee", async () => {
  const database = createDatabase({
    services: [
      { id: "service-z", name: "Zeta", business_id: "business", is_active: true, is_public: true },
      { id: "service-a", name: "Alfa", business_id: "business", is_active: true, is_public: true },
      { id: "service-b", name: "Beta", business_id: "business", is_active: true, is_public: true },
      { id: "service-hidden", name: "A", business_id: "business", is_active: true, is_public: false },
      { id: "other-service", name: "A", business_id: "other", is_active: true, is_public: true }
    ],
    employees: [
      { id: "employee-z", name: "Zeta", business_id: "business", is_active: true, is_public: true },
      { id: "employee-a", name: "Alfa", business_id: "business", is_active: true, is_public: false },
      { id: "employee-archived", name: "A", business_id: "business", is_active: false }
    ]
  });

  const access = await getPlanPublicAccess(database, "business", "free");

  assert.deepEqual([...access.serviceIds], ["service-a", "service-b"]);
  assert.deepEqual([...access.employeeIds], ["employee-z"]);
  assert.equal(database.queries.length, 2);
  assert.equal(database.queries.find((query) => query.table === "employees").filters.some(([column]) => column === "is_public"), true);
});

test("INFINITY public access has no caps or extra database queries", async () => {
  const database = createDatabase({});

  assert.equal(await getPlanPublicAccess(database, "business", "unlimited"), null);
  assert.equal(database.queries.length, 0);
});

test("Free public access fails closed when its candidate query fails", async () => {
  const database = {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        then(resolve, reject) {
          return Promise.resolve({ data: null, error: table === "employees" ? new Error("database unavailable") : null }).then(resolve, reject);
        }
      };
      return query;
    }
  };

  await assert.rejects(getPlanPublicAccess(database, "business", "free"), /Unable to validate plan public access/);
});

test("PRO downgrade excludes inherited excess resources from public bookings", async () => {
  const resources = (count) => Array.from({ length: count }, (_, index) => ({
    id: String(index), name: `Resource ${String(index).padStart(2, "0")}`,
    business_id: "business", is_active: true, is_public: true
  }));
  const database = createDatabase({ services: resources(12), employees: resources(5) });
  const access = await getPlanPublicAccess(database, "business", "pro");
  assert.equal(access.serviceIds.size, 10);
  assert.equal(access.employeeIds.size, 3);
  assert.equal(access.serviceIds.has("10"), false);
  assert.equal(access.employeeIds.has("3"), false);
});
