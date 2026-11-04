import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as validation from "../features/scheduling/special-availability.ts";

const require = createRequire(import.meta.url);
const ids = {
  opening: "10000000-0000-4000-8000-000000000001",
  service: "20000000-0000-4000-8000-000000000001",
  first: "30000000-0000-4000-8000-000000000001",
  second: "30000000-0000-4000-8000-000000000002"
};
const opening = { id: ids.opening, serviceId: ids.service, date: "2030-08-09", start: "09:00", end: "11:00", employeeIds: [ids.first, ids.second] };
function setup({ existing = null, blocked = [], assigned = [ids.first, ids.second], active = [ids.first, ids.second], duration = 30, hasService = true, databaseError = false } = {}) {
  const writes = [], reads = [];
  const db = {
    from(table) {
      const filters = [];
      let mutation;
      const query = {
        select: () => query, in: (key, value) => { filters.push([key, value]); return query; },
        eq: (key, value) => { filters.push([key, value]); return query; },
        lte: (key, value) => { filters.push([key, value]); return query; },
        gte: (key, value) => { filters.push([key, value]); return query; },
        maybeSingle: () => query,
        insert: (values) => { mutation = { action: "insert", values }; return query; },
        update: (values) => { mutation = { action: "update", values }; return query; },
        then(resolve, reject) {
          if (mutation) { writes.push({ table, filters, ...mutation }); return Promise.resolve({ error: null }).then(resolve, reject); }
          reads.push({ table, filters });
          const data = table === "services" ? hasService ? { id: ids.service, duration_minutes: duration } : null
            : table === "service_employees" ? assigned.map((employee_id) => ({ employee_id }))
            : table === "employees" ? active.map((id) => ({ id }))
            : table === "business_day_blocks" ? blocked : existing;
          return Promise.resolve({ data, error: databaseError ? new Error("Unavailable") : null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  const modules = {
    "server-only": {},
    "@/features/scheduling/special-availability": validation,
    "@/lib/networking/utils/date-time": { formatTodayForTimeZone: () => "2030-08-01" }
  };
  const url = new URL("./special-availability.ts", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  return { save: (input = opening) => loaded.exports.saveSpecialAvailability(db, "business", input, "UTC"), writes, reads };
}

test("exceptional availability validates real dates, complete time ranges and unique employee IDs", () => {
  assert.equal(validation.isValidSpecialAvailability(opening), true);
  for (const change of [{ date: "2030-02-30" }, { start: "25:00" }, { end: "09:00" }, { employeeIds: [] }, { employeeIds: [ids.first, ids.first] }, { serviceId: "bad" }, { employeeIds: ["bad"] }]) assert.equal(validation.isValidSpecialAvailability({ ...opening, ...change }), false);
});

test("opening creation saves all selected professionals and scopes all records to the business", async () => {
  const app = setup();
  await app.save();
  assert.equal(app.writes.length, 1);
  assert.equal(app.writes[0].action, "insert");
  assert.equal(app.writes[0].values.business_id, "business");
  assert.deepEqual(app.writes[0].values.employee_ids, [ids.first, ids.second]);
  for (const table of ["services", "employees", "business_day_blocks"]) assert.ok(app.reads.find((read) => read.table === table).filters.some(([key, value]) => key === "business_id" && value === "business"));
});

test("service assignment, inactive staff, ownership, closures and too short ranges are enforced before writing", async () => {
  for (const options of [{ assigned: [ids.first] }, { active: [ids.first] }, { hasService: false }, { existing: { business_id: "other" } }, { blocked: [{ employee_id: null }] }, { blocked: [{ employee_id: ids.second }] }, { duration: 180 }, { databaseError: true }]) {
    const app = setup(options);
    await assert.rejects(app.save());
    assert.equal(app.writes.length, 0);
  }
  const app = setup();
  await assert.rejects(app.save({ ...opening, date: "2030-07-01" }));
  assert.equal(app.reads.length, 0);
});

test("editing an owned opening uses a business-scoped update instead of an unrestricted upsert", async () => {
  const app = setup({ existing: { business_id: "business" } });
  await app.save();
  assert.equal(app.writes[0].action, "update");
  assert.deepEqual(app.writes[0].filters, [["id", ids.opening], ["business_id", "business"]]);
});
