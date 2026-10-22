import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import test from "node:test";
import ts from "typescript";
import { isValidMessageTemplate } from "../../../features/scheduling/message-templates.ts";

function setup(fail = false) {
  const queries = [];
  const database = { from(table) {
    const entry = { table, filters: [] }; queries.push(entry);
    const query = {
      select() { return query; },
      eq(key, value) { entry.filters.push([key, value]); return query; },
      order() { return query; },
      upsert(payload) { entry.payload = payload; return query; },
      delete() { entry.delete = true; return query; },
      then(resolve, reject) { return Promise.resolve({ data: [{ id: "saved", title: "Welcome", body: "Hello" }], error: fail ? new Error("Database unavailable") : null }).then(resolve, reject); }
    };
    return query;
  } };
  const url = new URL("./message-templates.ts", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => name.includes("supabase-browser") ? { getSupabaseBrowserClient: () => database } : { isValidMessageTemplate };
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, url.pathname);
  return { endpoint: loaded.exports, queries };
}

test("template reads, updates and deletion are scoped to the business", async () => {
  const { endpoint, queries } = setup();
  assert.deepEqual(await endpoint.getMessageTemplates("business"), [{ id: "saved", title: "Welcome", body: "Hello" }]);
  await endpoint.saveMessageTemplate("business", { id: "saved", title: " Name ", body: " Body " });
  await endpoint.deleteMessageTemplate("business", "saved");
  assert.deepEqual(queries[0].filters, [["business_id", "business"]]);
  assert.deepEqual(queries[1].payload, { id: "saved", business_id: "business", title: "Name", body: "Body" });
  assert.deepEqual(queries[2].filters, [["business_id", "business"], ["id", "saved"]]);
});

test("invalid templates never reach the database and failed operations are surfaced", async () => {
  const { endpoint, queries } = setup(true);
  await assert.rejects(endpoint.saveMessageTemplate("business", { id: "saved", title: " ", body: "Hello" }));
  assert.equal(queries.length, 0);
  await assert.rejects(endpoint.getMessageTemplates("business"));
  await assert.rejects(endpoint.saveMessageTemplate("business", { id: "saved", title: "Name", body: "Hello" }));
  await assert.rejects(endpoint.deleteMessageTemplate("business", "saved"));
});

test("saved templates require authenticated business membership for reads and writes", () => {
  const sql = readFileSync(new URL("../../../../docs/message-templates.sql", import.meta.url), "utf8");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all .* from anon/);
  assert.match(sql, /for all to authenticated/);
  assert.equal((sql.match(/membership.user_id = \(select auth.uid\(\)\)/g) ?? []).length, 2);
  assert.match(sql, /using \(exists/);
  assert.match(sql, /with check \(exists/);
});
