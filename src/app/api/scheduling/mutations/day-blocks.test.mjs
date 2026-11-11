import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as validation from "../../../../features/scheduling/utils/day-blocks.ts";
import * as booking from "../../../../features/booking-flow/utils/booking.ts";
import * as dateTime from "../../../../lib/networking/utils/date-time.ts";

const require = createRequire(import.meta.url);
const block = { id: "10000000-0000-4000-8000-000000000001", employeeId: "30000000-0000-4000-8000-000000000001", startsOn: "2099-08-09", endsOn: "2099-08-09", startTime: "14:00", endTime: "16:30", reason: "Absence" };
function setup({ role = "owner", existingBusiness = null, foreignEmployee = false, appointments = [], blocks = [], failRead = false } = {}) {
  const writes = [], reads = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from(table) {
      const filters = [];
      let mutation;
      const query = {
        select: () => query, limit: () => query,
        eq: (key, value) => { filters.push(["eq", key, value]); return query; },
        neq: (key, value) => { filters.push(["neq", key, value]); return query; },
        gt: (key, value) => { filters.push(["gt", key, value]); return query; },
        lt: (key, value) => { filters.push(["lt", key, value]); return query; },
        lte: (key, value) => { filters.push(["lte", key, value]); return query; },
        gte: (key, value) => { filters.push(["gte", key, value]); return query; },
        maybeSingle: () => query,
        upsert: (values) => { mutation = values; return query; },
        then(resolve, reject) {
          if (mutation) { writes.push({ table, values: mutation }); return Promise.resolve({ error: null }).then(resolve, reject); }
          reads.push({ table, filters });
          let data = table === "business_memberships" ? { role } : table === "businesses" ? { subscription_tier: "pro", timezone: "America/Argentina/Buenos_Aires" }
            : table === "employees" ? foreignEmployee ? null : { id: block.employeeId }
            : table === "business_day_blocks" ? filters.some(([op]) => op === "lte") ? blocks : existingBusiness ? { business_id: existingBusiness } : null : null;
          const count = table === "appointments" ? appointments.filter((row) => filters.every(([op, key, value]) => {
            if (op === "eq") return row[key] === value;
            if (op === "neq") return row[key] !== value;
            if (op === "gt") return row[key] > value;
            if (op === "lt") return row[key] < value;
            return true;
          })).length : 0;
          return Promise.resolve({ data, count, error: failRead && table === "business_day_blocks" ? new Error("Unavailable") : null }).then(resolve, reject);
        }
      };
      return query;
    }
  };
  const modules = {
    "next/server": { NextResponse: { json: (data, options) => ({ data, status: options?.status ?? 200 }) } },
    "@/features/scheduling/utils/day-blocks": validation,
    "@/features/booking-flow/utils/booking": booking,
    "@/lib/networking/clients/supabase-admin": { getSupabaseAdminClient: () => db },
    "@/lib/networking/utils/date-time": dateTime,
    "@/lib/referrals": { reconcileExpiredReferralTierForBusiness: async () => "pro" },
    "@/lib/slugs": { isUuid: (value) => typeof value === "string" && /^[0-9a-f-]{36}$/.test(value) },
    "@/lib/networking/mappers/scheduling": { mapBusinessDayBlocks: (rows) => rows },
    "@/lib/networking/api-errors": { getSafeErrorMessage: (error) => error.message, createApiErrorResponse: (error, options) => ({ data: { error }, status: options.status }) }
  };
  const url = new URL("./route.ts", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? (name.startsWith("@/") ? {} : require(name));
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText + "\nexports.createAppointmentForTest = createAppointment;", url.pathname);
  const request = (payload, authenticated = true) => loaded.exports.POST({ headers: new Headers(authenticated ? { authorization: "Bearer test" } : {}), json: async () => ({ businessId: "business", ...payload }) });
  return { writes, reads, request, create: (appointment) => loaded.exports.createAppointmentForTest(db, "business", appointment, {}, "UTC", []), save: (input = block, authenticated = true) => request({ action: "saveBusinessDayBlock", dayBlock: input }, authenticated) };
}

test("hourly block writes require an authenticated owner or admin and same-business ownership", async () => {
  for (const [options, authorized, expected] of [[{}, false, 401], [{ role: "member" }, true, 403], [{ existingBusiness: "other" }, true, 409], [{ foreignEmployee: true }, true, 409], [{ failRead: true }, true, 409]]) {
    const app = setup(options);
    assert.equal((await app.save(block, authorized)).status, expected);
    assert.equal(app.writes.length, 0);
  }
  const app = setup({ role: "admin" });
  assert.equal((await app.save()).status, 200);
  assert.deepEqual(app.writes[0].values, { id: block.id, business_id: "business", employee_id: block.employeeId, starts_on: block.startsOn, ends_on: block.endsOn, start_time: "14:00", end_time: "16:30", reason: "Absence" });
});

test("server rejects invalid hourly payloads before writing", async () => {
  for (const change of [{ employeeId: null }, { endsOn: "2099-08-10" }, { startTime: "25:00" }, { endTime: "14:00" }, { endTime: null }, { startTime: "" }, { startsOn: "2020-01-01", endsOn: "2020-01-01" }]) {
    const app = setup();
    assert.equal((await app.save({ ...block, ...change })).status, 409);
    assert.equal(app.writes.length, 0);
  }
});

const appointment = (start, end, employee = block.employeeId, status = "scheduled") => ({ business_id: "business", employee_id: employee, appointment_status: status, starts_at: `2099-08-09T${start}:00.000Z`, ends_at: `2099-08-09T${end}:00.000Z` });

test("saving a block checks overlap in the business time zone including appointments starting before it", async () => {
  // The requested 14:00-16:30 local interval is 17:00-19:30 UTC.
  for (const row of [appointment("16:30", "17:30"), appointment("17:00", "19:30"), appointment("19:00", "20:00")]) {
    const app = setup({ appointments: [row] });
    assert.equal((await app.save()).status, 409);
    assert.equal(app.writes.length, 0);
  }
  const app = setup({ appointments: [appointment("16:00", "17:00"), appointment("19:30", "20:00"), appointment("17:00", "19:00", "another"), appointment("17:00", "19:00", block.employeeId, "cancelled"), appointment("17:00", "19:00", block.employeeId, "rescheduled")] });
  assert.equal((await app.save()).status, 200);
});

test("full-day writes remain compatible and hourly midnight uses the next day's boundary", async () => {
  const full = setup();
  assert.equal((await full.save({ ...block, startTime: null, endTime: null, employeeId: null })).status, 200);
  assert.equal(full.writes[0].values.start_time, null);
  const app = setup();
  assert.equal((await app.save({ ...block, startTime: "23:30", endTime: "24:00" })).status, 200);
  assert.ok(app.reads.find((read) => read.table === "appointments").filters.some(([op, key, value]) => op === "lt" && key === "starts_at" && value === "2099-08-10T03:00:00.000Z"));
});

test("rescheduling rejects overlapping blocks before updating appointments and allows adjacent ranges through validation", async () => {
  const app = setup({ blocks: [block] });
  const payload = { action: "rescheduleAppointment", appointmentId: "appointment", date: block.startsOn, employeeId: block.employeeId, startTime: "13:30", endTime: "14:30" };
  const response = await app.request(payload);
  assert.equal(response.status, 409);
  assert.match(response.data.error, /horario está bloqueado/);
  assert.equal(app.reads.some((read) => read.table === "appointments"), false);
  const adjacent = setup({ blocks: [block] });
  const next = await adjacent.request({ ...payload, startTime: "13:00", endTime: "14:00" });
  assert.ok(adjacent.reads.some((read) => read.table === "appointments"));
  assert.doesNotMatch(next.data.error, /horario está bloqueado/);
});


test("creating an appointment rejects blocked hours before customer or appointment writes", async () => {
  const app = setup({ blocks: [block] });
  await assert.rejects(app.create({ date: block.startsOn, employeeId: block.employeeId, startTime: "14:00", endTime: "14:30" }), /horario está bloqueado/);
  assert.equal(app.writes.length, 0);
  assert.equal(app.reads.some((read) => read.table === "customers" || read.table === "appointments"), false);
});
