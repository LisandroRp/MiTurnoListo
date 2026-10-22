import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { employeeColorClasses } from "./employeeColors.ts";
import { employeeDisplayColorKeys, getNextEmployeeColor } from "../employee-colors.ts";

test("new employees receive unused persisted colors before the palette repeats", () => {
  const employees = [];
  for (const color of employeeDisplayColorKeys) {
    const selected = getNextEmployeeColor(employees);
    assert.equal(selected, color);
    assert.ok(employeeColorClasses[selected]);
    employees.push({ id: `employee-${employees.length}`, color: selected });
  }
  assert.equal(employeeDisplayColorKeys.length, 12);
  assert.equal(new Set(employees.map((employee) => employee.color)).size, 12);
  assert.equal(getNextEmployeeColor(employees), employeeDisplayColorKeys[0]);
  employees.push({ id: "thirteenth", color: employeeDisplayColorKeys[0] });
  assert.equal(getNextEmployeeColor(employees), employeeDisplayColorKeys[1]);
});

test("choosing the next color does not recolor existing employees or depend on list order", () => {
  const employees = [
    { id: "one", color: "employee-blue", isVisible: false },
    { id: "two", color: "employee-coral", isArchived: true },
    { id: "three", color: "employee-violet" }
  ];
  const original = structuredClone(employees);
  assert.equal(getNextEmployeeColor(employees), "employee-green");
  assert.equal(getNextEmployeeColor([...employees].reverse()), "employee-green");
  assert.deepEqual(employees, original);
});

test("service and calendar screens use stored colors and preserve fixed circular markers", () => {
  const source = readFileSync(new URL("./ServicesView.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /assignEmployeeDisplayColors/);
  const markers = [...source.matchAll(/<span className=\{cx\("([^"]+)", employeeColorClasses\[employee.color\]\)\}[^>]*\/>/g)];
  assert.equal(markers.length, 2);
  for (const marker of markers) {
    assert.match(marker[1], /h-3 w-3 shrink-0 rounded-full/);
    assert.match(source.slice(marker.index + marker[0].length, marker.index + marker[0].length + 180), /min-w-0/);
  }
  const calendar = readFileSync(new URL("./CalendarView.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(calendar, /calendarEmployeeColorKeys|color:.*index/);
  const repair = readFileSync(new URL("../../../../docs/employee-colors.sql", import.meta.url), "utf8");
  const globals = readFileSync(new URL("../../../app/globals.css", import.meta.url), "utf8");
  for (const color of employeeDisplayColorKeys) {
    assert.ok(repair.includes(`'${color}'`));
    assert.ok(globals.includes(`--color-${color}: var(--${color});`));
    assert.ok(globals.includes(`--${color}: oklch(`));
    assert.ok(calendar.includes(`border-${color}/35 bg-${color}/12 hover:bg-${color}/18`));
    assert.ok(calendar.includes(`"${color}": "bg-${color}"`));
  }
});
