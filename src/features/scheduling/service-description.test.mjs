import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as description from "./service-description.ts";

const require = createRequire(import.meta.url);

test("service description allows empty text and the exact limit but rejects oversized input", () => {
  assert.equal(description.serviceDescriptionMaxLength, 333);
  for (const value of ["", "**Welcome**\n- __Item__", "x".repeat(333)]) assert.equal(description.isValidServiceDescription(value), true);
  for (const value of ["x".repeat(334), null, undefined, 123, {}]) assert.equal(description.isValidServiceDescription(value), false);
});

test("service mutation rejects overlong descriptions before writing service data", async () => {
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from(table) {
      const query = {
        select: () => query, eq: () => query, limit: () => query,
        maybeSingle: async () => ({ data: table === "business_memberships" ? { role: "owner" } : { subscription_tier: "pro", timezone: "UTC" } })
      };
      assert.ok(["business_memberships", "businesses"].includes(table));
      return query;
    }
  };
  const modules = {
    "next/server": { NextResponse: { json: (data, options) => ({ data, status: options?.status ?? 200 }) } },
    "@/features/scheduling/service-description": description,
    "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => db },
    "@/lib/referrals": { reconcileExpiredReferralTierForBusiness: async () => "pro" }
  };
  const url = new URL("../../app/api/scheduling/mutations/route.ts", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? (name.startsWith("@/") ? {} : require(name));
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  const result = await loaded.exports.POST({ headers: new Headers({ authorization: "Bearer example" }), json: async () => ({ action: "saveService", businessId: "business", service: { description: "x".repeat(334) } }) });
  assert.equal(result.status, 400);
});

test("service editor reuses the formatting controls with a limit and counter", () => {
  const source = readFileSync(new URL("./components/ServicesView.tsx", import.meta.url), "utf8");
  assert.match(source, /<FormattingTextArea[\s\S]*?value=\{draft.description\}[\s\S]*?maxLength=\{serviceDescriptionMaxLength\}[\s\S]*?helperText=\{`\$\{draft.description.length\}\/\$\{serviceDescriptionMaxLength\}`\}/);
  assert.match(source, /!isValidServiceDescription\(service.description\)/);
});
