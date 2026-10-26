import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const url = new URL("./CalendarView.tsx", import.meta.url);
const options = { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } };
const messagesUrl = new URL("../i18n/messages.ts", import.meta.url);
const messagesModule = new Module(messagesUrl.pathname);
messagesModule._compile(ts.transpileModule(readFileSync(messagesUrl, "utf8"), options).outputText, messagesUrl.pathname);
const messages = messagesModule.exports.messages.es;

function harness() {
  const modules = {
    react: { useState: (value) => [value, () => {}], useRef: () => ({ current: null }) },
    "@/components/composed/CollapsibleRow": { CollapsibleRow: "CollapsibleRow" },
    "@/components/composed/SectionHeader": { SectionHeader: "SectionHeader" },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
    "@/features/scheduling/plan-limits": {
      getMonthlyAppointmentUsage: () => 0, isFreePlan: () => false,
      hasReachedFreeMonthlyAppointmentLimit: () => false
    },
    "@/features/scheduling/utils/format": { getDateLabel: (value) => value },
    "@/features/booking-flow/utils/booking": {},
    "@/features/scheduling/components/dashboardTeamUtils": {},
    "@/features/scheduling/service-cancellation-policy": {},
    "@/features/scheduling/components/CalendarView/BusinessDayBlocksModal": { BusinessDayBlocksModal: "BusinessDayBlocksModal" }
  };
  for (const name of ["Badge", "Button", "Card", "Modal", "SelectField", "TextAreaField", "TextField"]) modules[`@/components/ui/${name}`] = { [name]: name };
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), options).outputText, url.pathname);
  const employees = ["a", "b", "scheduled", "cancelled", "archived"].map((id) => ({ id, name: id, color: "employee-blue", isArchived: id === "archived", schedule: { mon: [{ start: "09:00", end: "17:00" }] } }));
  const appointment = (employeeId, date, appointmentStatus = "reserved") => ({ id: `${employeeId}-${date}`, employeeId, date, appointmentStatus });
  const props = {
    messages, employees, services: [], businessDayBlocks: [], subscriptionTier: "pro", mode: "day", focusedDate: "2026-10-26",
    selectedEmployeeIds: employees.map((employee) => employee.id), employeeQuery: "",
    appointments: [appointment("a", "2026-10-26"), appointment("b", "2026-10-27"), appointment("b", "2026-11-02"), appointment("b", "2026-11-15"), appointment("cancelled", "2026-10-26", "cancelled"), appointment("archived", "2026-10-26")],
    onToggleEmployee: (id) => toggled.push(id), onFocusedDateChange: (date) => { props.focusedDate = date; }
  };
  const toggled = [];
  let tree;
  const nodes = (node = tree) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children, node.props?.actions].flat(Infinity).filter((child) => child && typeof child === "object").flatMap((child) => nodes(child))];
  const render = () => { tree = loaded.exports.CalendarView(props); };
  const visible = () => nodes().find((node) => node.type === "CollapsibleRow").props.children.filter(Boolean);
  const navigate = (direction) => {
    nodes().find((node) => node.type === "Button" && node.props["aria-label"] === messages.calendar[direction]).props.onClick();
    render();
  };
  return { props, render, visible, nodes, navigate, toggled };
}

for (const mode of ["day", "week", "month"]) {
  test(`${mode} staff follows the displayed period when navigating forward and backward`, () => {
    const app = harness();
    app.props.mode = mode;
    app.render();
    assert.deepEqual(app.visible().map((node) => node.key), mode === "day" ? ["a"] : ["a", "b"]);
    app.navigate("nextPeriod");
    assert.deepEqual(app.visible().map((node) => node.key), ["b"]);
    app.navigate("previousPeriod");
    assert.deepEqual(app.visible().map((node) => node.key), mode === "day" ? ["a"] : ["a", "b"]);
    app.props.focusedDate = "2027-01-25";
    app.render();
    assert.deepEqual(app.visible(), []);
    const dropdown = app.nodes().find((node) => node.type?.name === "EmployeeDropdown");
    assert.deepEqual(dropdown.props.employees.map((employee) => employee.id), ["a", "b", "scheduled", "cancelled"]);
    assert.equal(app.nodes().some((node) => node.type === "Button" && node.props.children === "Con turnos"), false);
  });
}

test("staff can be toggled back on and the full selector stays searchable", () => {
  const app = harness();
  app.props.selectedEmployeeIds = [];
  app.props.employeeQuery = "scheduled";
  app.render();
  assert.equal(app.visible()[0].props["aria-pressed"], false);
  app.visible()[0].props.onClick();
  assert.deepEqual(app.toggled, ["a"]);
  const dropdown = app.nodes().find((node) => node.type?.name === "EmployeeDropdown");
  assert.deepEqual(dropdown.props.employees.map((employee) => employee.id), ["scheduled"]);
});
