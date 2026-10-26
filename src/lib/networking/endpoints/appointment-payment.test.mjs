import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
test("payment endpoint forwards optional amount and comment without changing legacy calls", async () => {
  const url = new URL("./scheduling.ts", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => name === "@/lib/networking/endpoints/auth" ? { getAccessToken: async () => "test-token" } : name.startsWith("@/") ? {} : require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, url.pathname);
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, options }); return { ok: true }; };
  try {
    await loaded.exports.markAppointmentPaid("business", "appointment", 15.5, "Extra");
    assert.deepEqual(JSON.parse(requests[0].options.body), { action: "markAppointmentPaid", businessId: "business", appointmentId: "appointment", amount: 15.5, paymentNote: "Extra" });
    assert.equal(requests[0].options.headers.Authorization, "Bearer test-token");
    await loaded.exports.markAppointmentPaid("business", "appointment");
    assert.deepEqual(JSON.parse(requests[1].options.body), { action: "markAppointmentPaid", businessId: "business", appointmentId: "appointment" });
  } finally { globalThis.fetch = previousFetch; }
});
