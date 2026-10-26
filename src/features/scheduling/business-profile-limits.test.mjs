import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, modules = {}) {
  const url = new URL(path, import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  return loaded.exports;
}
const limits = load("./business-profile-limits.ts");

test("business text limits accept boundaries and reject overlong or non-text fields", () => {
  assert.equal(limits.hasInvalidBusinessProfileText({}), false);
  for (const [field, limit] of Object.entries(limits.businessProfileTextLimits)) {
    assert.equal(limits.hasInvalidBusinessProfileText({ [field]: "x".repeat(limit) }), false);
    assert.equal(limits.hasInvalidBusinessProfileText({ [field]: "x".repeat(limit + 1) }), true);
    for (const invalid of [null, 42, {}, []]) assert.equal(limits.hasInvalidBusinessProfileText({ [field]: invalid }), true);
  }
});

test("business profile API rejects oversized fields before writing to the database", async () => {
  let writes = 0;
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: (table) => {
      const chain = {
        select: () => chain, eq: () => chain, limit: () => chain,
        maybeSingle: async () => ({ data: { role: "owner" } }),
        update: () => { writes++; throw new Error("Unexpected database write"); }
      };
      assert.equal(table, "business_memberships");
      return chain;
    }
  };
  const { PUT } = load("../../app/api/business-profile/route.ts", {
    "@/features/scheduling/business-profile-limits": limits,
    "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => supabase },
    "@/lib/networking/api-errors": { getSafeErrorMessage: () => "Unexpected error", createApiErrorResponse: () => new Response(null, { status: 500 }) },
    "@/lib/slugs": {}
  });
  for (const [field, limit] of Object.entries(limits.businessProfileTextLimits)) {
    const response = await PUT(new Request("http://localhost/api/business-profile", {
      method: "PUT", headers: { authorization: "Bearer example", "content-type": "application/json" },
      body: JSON.stringify({ businessId: "business", profile: { [field]: "x".repeat(limit + 1) } })
    }));
    assert.equal(response.status, 400);
  }
  assert.equal(writes, 0);
});
