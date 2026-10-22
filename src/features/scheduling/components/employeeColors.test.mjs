import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { assignEmployeeDisplayColors, employeeColorClasses, employeeDisplayColorKeys } from "./employeeColors.ts";

test("repeated stored colors receive the same varied display palette as the calendar", () => {
  const employees = Array.from({ length: 9 }, (_, index) => ({
    id: `employee-${index}`, name: `Employee ${index}`, color: "employee-coral", isArchived: false
  }));
  const colored = assignEmployeeDisplayColors(employees);
  assert.equal(new Set(colored.slice(0, 8).map((employee) => employee.color)).size, 8);
  assert.equal(colored[8].color, colored[0].color);
  assert.deepEqual(colored.map((employee) => employee.id), employees.map((employee) => employee.id));
  assert.ok(employees.every((employee) => employee.color === "employee-coral"));
  for (const [index, employee] of colored.entries()) {
    assert.equal(employee.color, employeeDisplayColorKeys[index % employeeDisplayColorKeys.length]);
    assert.ok(employeeColorClasses[employee.color]);
  }
});

test("hiding or selecting an employee does not change the remaining display colors", () => {
  const employees = [
    { id: "hidden", color: "employee-coral", isVisible: false },
    { id: "selected", color: "employee-coral", isVisible: true },
    { id: "visible", color: "employee-coral", isVisible: true }
  ];
  const colored = assignEmployeeDisplayColors(employees);
  assert.deepEqual(colored.filter((employee) => employee.isVisible).map((employee) => employee.color), employeeDisplayColorKeys.slice(1, 3));
  assert.equal(colored.find((employee) => employee.id === "selected").color, "employee-coral");
  assert.deepEqual(assignEmployeeDisplayColors([]), []);
});

test("service staff selection and review keep fixed circular markers with truncatable names", () => {
  const source = readFileSync(new URL("./ServicesView.tsx", import.meta.url), "utf8");
  assert.match(source, /const employees = assignEmployeeDisplayColors\(storedEmployees\)/);
  const markers = [...source.matchAll(/<span className=\{cx\("([^"]+)", employeeColorClasses\[employee.color\]\)\}[^>]*\/>/g)];
  assert.equal(markers.length, 2);
  for (const marker of markers) {
    assert.match(marker[1], /h-3 w-3 shrink-0 rounded-full/);
    assert.match(source.slice(marker.index + marker[0].length, marker.index + marker[0].length + 180), /min-w-0/);
  }
  const calendar = readFileSync(new URL("./CalendarView.tsx", import.meta.url), "utf8");
  assert.match(calendar, /employeeDisplayColorKeys as calendarEmployeeColorKeys/);
});
