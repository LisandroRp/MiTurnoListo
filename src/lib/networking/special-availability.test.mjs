import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import test from "node:test";
import ts from "typescript";

const url = new URL("./special-availability.ts", import.meta.url);
const loaded = new Module(url.pathname);
loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
const { loadSpecialAvailability } = loaded.exports;
function database(error, data = []) {
  const filters = [];
  const query = { select: () => query, eq: (key, value) => { filters.push([key, value]); return query; }, order: async () => ({ data, error }) };
  return { client: { from: (table) => { assert.equal(table, "service_special_availability"); return query; } }, filters };
}

test("dated availability maps database rows and scopes service queries to the business", async () => {
  const db = database(null, [{ id: "opening", service_id: "service", date: "2030-08-09", start_time: "09:00:00", end_time: "11:00:00", employee_ids: ["employee"] }]);
  assert.deepEqual(await loadSpecialAvailability(db.client, "business", "service"), [{ id: "opening", serviceId: "service", date: "2030-08-09", start: "09:00", end: "11:00", employeeIds: ["employee"] }]);
  assert.deepEqual(db.filters, [["business_id", "business"], ["service_id", "service"]]);
});

test("missing migration keeps existing weekly scheduling readable but other database errors fail closed", async () => {
  for (const code of ["PGRST205", "42P01"]) assert.deepEqual(await loadSpecialAvailability(database({ code }).client, "business"), []);
  await assert.rejects(loadSpecialAvailability(database({ code: "42501" }).client, "business"), /Unable to load/);
});
