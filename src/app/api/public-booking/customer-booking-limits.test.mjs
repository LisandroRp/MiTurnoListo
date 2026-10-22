import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import test from "node:test";
import { NextResponse } from "next/server.js";
import ts from "typescript";

const fileUrl = new URL("./[serviceId]/route.ts", import.meta.url);
const source = readFileSync(fileUrl, "utf8");
const output = ts.transpileModule(`${source}\nexport { enforceCustomerBookingLimitForSelectedDate, enforceCustomerBookingSubmissionLimitPerDay };`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const loaded = new Module(fileUrl.pathname);
loaded.filename = fileUrl.pathname;
loaded.require = (specifier) => {
  if (specifier === "next/server") return { NextResponse };
  if (specifier === "@/lib/networking/utils/date-time") return {
    buildIsoInTimeZone: (date) => `${date}T00:00:00.000Z`,
    formatDateForTimeZone: (value) => value.slice(0, 10)
  };
  return {};
};
loaded._compile(output, fileUrl.pathname);

function createDatabase(rows, fail = false) {
  const filters = [];
  const query = {
    select() { return query; },
    eq: (column, value) => { filters.push((row) => row[column] === value); return query; },
    ilike: (column, value) => { filters.push((row) => row[column].toLowerCase() === value.toLowerCase()); return query; },
    neq: (column, value) => { filters.push((row) => row[column] !== value); return query; },
    gte: (column, value) => { filters.push((row) => row[column] >= value); return query; },
    lt: (column, value) => { filters.push((row) => row[column] < value); return query; },
    then: (resolve, reject) => Promise.resolve({ count: rows.filter((row) => filters.every((filter) => filter(row))).length, error: fail ? new Error("Unavailable") : null }).then(resolve, reject)
  };
  return { from: (table) => { assert.equal(table, "appointments"); return query; } };
}

for (const [name, helper, column] of [
  ["selected appointment date", loaded.exports.enforceCustomerBookingLimitForSelectedDate, "starts_at"],
  ["booking submission day", loaded.exports.enforceCustomerBookingSubmissionLimitPerDay, "created_at"]
]) {
  const date = new Date().toISOString().slice(0, 10);
  const row = { business_id: "business", customer_email_snapshot: "Owner@example.com", appointment_status: "confirmed", [column]: `${date}T12:00:00.000Z` };
  function validate(database) {
    const args = [database, "business", "owner@example.com"];
    return helper(...args, ...(column === "starts_at" ? [date, "UTC"] : ["UTC"]));
  }

  test(`${name}: permits the first three bookings and rejects the fourth`, async () => {
    for (const count of [0, 1, 2]) {
      assert.deepEqual(await validate(createDatabase(Array.from({ length: count }, () => ({ ...row })))), { canBook: true });
    }
    for (const count of [3, 4]) {
      const { response } = await validate(createDatabase(Array.from({ length: count }, () => ({ ...row }))));
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, /3 reservas/);
    }
  });

  test(`${name}: isolates the business, email and date and excludes cancelled or rescheduled bookings`, async () => {
    const rows = [
      row, row,
      { ...row, business_id: "other-business" },
      { ...row, customer_email_snapshot: "other@example.com" },
      { ...row, appointment_status: "cancelled" },
      { ...row, appointment_status: "rescheduled" },
      { ...row, [column]: "2000-01-01T12:00:00.000Z" },
      { ...row, [column]: "2099-01-01T12:00:00.000Z" }
    ];
    assert.deepEqual(await validate(createDatabase(rows)), { canBook: true });
  });

  test(`${name}: query failures do not permit booking`, async () => {
    const { response } = await validate(createDatabase([], true));
    assert.equal(response.status, 500);
  });
}

test("public booking applies both daily checks before creating the appointment", () => {
  const dateCheck = source.indexOf("await enforceCustomerBookingLimitForSelectedDate(");
  const submissionCheck = source.indexOf("await enforceCustomerBookingSubmissionLimitPerDay(");
  const insert = source.indexOf('.from("appointments")', submissionCheck);
  assert.ok(dateCheck > 0 && submissionCheck > dateCheck && insert > submissionCheck);
});
