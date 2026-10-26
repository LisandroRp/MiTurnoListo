import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as payment from "../../../../features/scheduling/appointment-payment.ts";

const require = createRequire(import.meta.url);
function setup({ appointment = {}, role = "owner", concurrent = false } = {}) {
  const row = { id: "appointment", business_id: "business", appointment_status: "scheduled", status: "pending", payment_status: "pending", total_amount: 1, ...appointment };
  const writes = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from(table) {
      let update, filters = [];
      const query = {
        select: () => query, limit: () => query, eq: (name, value) => { filters.push([name, value]); return query; },
        update: (value) => { update = value; return query; },
        maybeSingle: async () => {
          if (table === "business_memberships") return { data: { role } };
          if (table === "businesses") return { data: { subscription_tier: "pro", timezone: "America/Argentina/Buenos_Aires" } };
          assert.equal(table, "appointments");
          if (!update) return { data: row };
          if (concurrent) return { data: null };
          writes.push({ update, filters });
          return { data: { id: row.id } };
        }
      };
      return query;
    }
  };
  const modules = {
    "next/server": { NextResponse: { json: (data, options) => ({ data, status: options?.status ?? 200 }) } },
    "@/features/scheduling/appointment-payment": payment,
    "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => db },
    "@/lib/referrals": { reconcileExpiredReferralTierForBusiness: async () => "pro" },
    "@/lib/networking/api-errors": {
      getSafeErrorMessage: (error) => error instanceof Error ? error.message : String(error),
      createApiErrorResponse: (error, options) => ({ data: { error: String(error) }, status: options.status })
    }
  };
  const url = new URL("./route.ts", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => modules[name] ?? (name.startsWith("@/") ? {} : require(name));
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, url.pathname);
  const request = (payload = {}, authorized = true) => loaded.exports.POST({ headers: new Headers(authorized ? { authorization: "Bearer token" } : {}), json: async () => ({ action: "markAppointmentPaid", businessId: "business", appointmentId: "appointment", ...payload }) });
  return { request, writes };
}

test("manual acceptance atomically stores the adjusted total and optional internal comment", async () => {
  const app = setup();
  assert.equal((await app.request({ amount: 12000.5, paymentNote: "  Adicional  " })).status, 200);
  assert.deepEqual(app.writes[0].update, { status: "confirmed", payment_status: "paid", total_amount: 12000.5, payment_note: "Adicional" });
  assert.ok(app.writes[0].filters.some(([key, value]) => key === "business_id" && value === "business"));
  assert.ok(app.writes[0].filters.some(([key, value]) => key === "payment_status" && value === "pending"));
  assert.ok(app.writes[0].filters.some(([key, value]) => key === "total_amount" && value === 1));
});

test("unchanged and legacy acceptances preserve the stored amount and note", async () => {
  const app = setup();
  await app.request();
  assert.deepEqual(app.writes[0].update, { status: "confirmed", payment_status: "paid" });
  const unchanged = setup(); await unchanged.request({ amount: 1, paymentNote: "ignored" });
  assert.equal("payment_note" in unchanged.writes[0].update, false);
  const zero = setup(); await zero.request({ amount: 0 });
  assert.equal(zero.writes[0].update.total_amount, 0);
  assert.equal(zero.writes[0].update.payment_note, null);
});

test("server rejects invalid payment input, unauthorized writes and stale updates", async () => {
  for (const payload of [{ amount: -1 }, { amount: "123" }, { amount: null }, { amount: Infinity }, { amount: 1.234 }, { amount: 1000000000 }, { paymentNote: {} }, { paymentNote: "x".repeat(101) }]) {
    const app = setup(); assert.equal((await app.request(payload)).status, 409); assert.deepEqual(app.writes, []);
  }
  for (const role of ["member", "employee"]) {
    const app = setup({ role }); assert.equal((await app.request({ amount: 5 })).status, 403); assert.deepEqual(app.writes, []);
  }
  const anonymous = setup(); assert.equal((await anonymous.request({}, false)).status, 401);
  for (const appointment of [{ business_id: "other" }, { appointment_status: "cancelled" }, { appointment_status: "rescheduled" }]) {
    const app = setup({ appointment }); assert.equal((await app.request({ amount: 5 })).status, 500); assert.deepEqual(app.writes, []);
  }
  const paid = setup({ appointment: { payment_status: "paid", status: "confirmed" } });
  assert.equal((await paid.request({ amount: 5 })).status, 200); assert.deepEqual(paid.writes, []);
  const stale = setup({ concurrent: true }); assert.equal((await stale.request({ amount: 5 })).status, 500); assert.deepEqual(stale.writes, []);
});


test("payment comments accept exactly 100 characters", async () => {
  const app = setup();
  const note = "x".repeat(100);
  assert.equal((await app.request({ amount: 15, paymentNote: note })).status, 200);
  assert.equal(app.writes[0].update.payment_note, note);
});
