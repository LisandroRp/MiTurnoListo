import assert from "node:assert/strict";
import test from "node:test";

import { getEmployeesWorkingNowOnDate } from "./dashboardTeamUtils.ts";

function createEmployee(overrides = {}) {
  return {
    id: "employee-1",
    name: "Jane Doe",
    role: "Professional",
    description: "",
    imageUrl: "",
    color: "employee-coral",
    initials: "JD",
    isVisible: true,
    isArchived: false,
    schedule: createSchedule({ monday: [{ id: "monday-1", start: "09:00", end: "17:00" }] }),
    ...overrides
  };
}

function createSchedule(overrides = {}) {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
    ...overrides
  };
}

test("getEmployeesWorkingNowOnDate returns employees inside the current schedule range", () => {
  const employees = getEmployeesWorkingNowOnDate(
    [createEmployee()],
    "2026-08-03",
    new Date("2026-08-03T10:30:00")
  );

  assert.deepEqual(employees.map((employee) => employee.id), ["employee-1"]);
});

test("getEmployeesWorkingNowOnDate excludes employees after their schedule range ends", () => {
  const employees = getEmployeesWorkingNowOnDate(
    [createEmployee()],
    "2026-08-03",
    new Date("2026-08-03T23:00:00")
  );

  assert.deepEqual(employees, []);
});

test("getEmployeesWorkingNowOnDate excludes employees when the selected date is not today", () => {
  const employees = getEmployeesWorkingNowOnDate(
    [createEmployee()],
    "2026-08-03",
    new Date("2026-08-04T10:30:00")
  );

  assert.deepEqual(employees, []);
});
