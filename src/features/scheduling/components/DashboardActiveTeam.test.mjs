import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { messages } from "../i18n/messages.ts";
import { employeeDisplayColorKeys } from "../employee-colors.ts";
import { employeeColorClasses } from "./employeeColors.ts";

const require = createRequire(import.meta.url);

function setup(initialEmployees = []) {
  let expanded = false;
  let tree;
  let employees = initialEmployees;
  const clicked = [];
  const modules = {
    react: { useId: () => "active-team", useState: () => [expanded, (update) => { expanded = typeof update === "function" ? update(expanded) : update; }] },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
    "@/features/scheduling/components/dashboardTeamUtils": { getDayKeyForDate: () => "thursday" },
    "@/features/scheduling/components/employeeColors": { employeeColorClasses }
  };
  for (const name of ["Badge", "Button", "Card"]) modules[`@/components/ui/${name}`] = { [name]: name };
  const url = new URL("./DashboardActiveTeam.tsx", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, url.pathname);
  function render(nextEmployees = employees) {
    employees = nextEmployees;
    tree = loaded.exports.DashboardActiveTeam({
      employees, appointments: [{ employeeId: "employee-0" }, { employeeId: "employee-0" }], referenceDate: "2026-10-22", messages: messages.es,
      onEmployeeClick: (employee) => clicked.push(employee.id)
    });
    return tree;
  }
  function nodes(node = tree) {
    if (!node || typeof node !== "object") return [];
    return [node, ...[node.props?.children].flat(Infinity).filter((child) => child && typeof child === "object").flatMap((child) => nodes(child))];
  }
  render();
  return { render, nodes, clicked, toggle: () => nodes().find((node) => node.type === "Button"), region: () => nodes().find((node) => node.props?.role === "region") };
}

const employees = Array.from({ length: 5 }, (_, index) => ({
  id: `employee-${index}`, name: `Professional ${index}`, initials: `P${index}`, role: "Role", color: employeeDisplayColorKeys[index],
  schedule: { thursday: index === 0 ? [{ start: "09:00", end: "18:00" }] : [] }
}));

test("active team starts compact, limits the desktop summary and makes hidden details unfocusable", () => {
  const app = setup(employees);
  assert.equal(app.toggle().props["aria-expanded"], false);
  assert.equal(app.toggle().props["aria-controls"], app.region().props.id);
  assert.equal(app.region().props.inert, true);
  assert.equal(app.region().props["aria-hidden"], true);
  assert.match(app.region().props.className, /grid-rows-\[0fr\]/);
  const summaryNames = app.nodes().filter((node) => node.props?.title?.startsWith("Professional"));
  assert.equal(summaryNames.length, 3);
  for (const [index, name] of summaryNames.entries()) {
    assert.ok(name.props.children[0].props.className.includes(employeeColorClasses[employees[index].color]));
  }
  assert.ok(app.nodes().some((node) => Array.isArray(node.props?.children) && node.props.children.join("") === "+2"));
  assert.ok(app.nodes().some((node) => node.type === "Badge" && node.props.children === 5));
  assert.ok(app.nodes().some((node) => node.props?.className?.includes("hidden min-w-0 flex-1") && node.props.className.includes("sm:flex")));
});

test("expanding shows every professional with hours and appointment counts, preserves navigation and collapses again", () => {
  const app = setup(employees);
  app.toggle().props.onClick(); app.render();
  assert.equal(app.toggle().props["aria-expanded"], true);
  assert.equal(app.region().props.inert, false);
  assert.equal(app.region().props["aria-hidden"], false);
  assert.match(app.region().props.className, /grid-rows-\[1fr\]/);
  assert.match(app.region().props.className, /motion-reduce:transition-none/);
  const cards = app.nodes().filter((node) => node.type === "button");
  assert.equal(cards.length, 5);
  cards[0].props.onClick();
  assert.deepEqual(app.clicked, ["employee-0"]);
  const facts = app.nodes().filter((node) => node.type?.name === "TeamFact");
  assert.ok(facts.some((fact) => fact.props.value === "09:00 - 18:00"));
  assert.ok(facts.some((fact) => fact.props.value === "2 turnos"));
  assert.ok(facts.some((fact) => fact.props.value === messages.es.home.noTodayHours));
  app.toggle().props.onClick(); app.render();
  assert.equal(app.region().props.inert, true);
});

test("an empty active team shows a compact message without an expansion control", () => {
  const app = setup();
  assert.equal(app.toggle(), undefined);
  assert.equal(app.region(), undefined);
  assert.ok(app.nodes().some((node) => node.props?.children === messages.es.home.noActiveTeam));
  assert.equal(app.nodes().some((node) => node.props?.className?.includes("h-[34rem]")), false);
});
