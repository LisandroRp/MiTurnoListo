import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as employeeColors from "../employeeColors.ts";
import * as validation from "../../special-availability.ts";
import * as booking from "../../../booking-flow/utils/booking.ts";
import { messages } from "../../i18n/messages.ts";

const require = createRequire(import.meta.url);
const serviceId = "20000000-0000-4000-8000-000000000001";
const employeeId = "30000000-0000-4000-8000-000000000001";
const secondId = "30000000-0000-4000-8000-000000000002";
const flush = () => new Promise((resolve) => setImmediate(resolve));
function harness() {
  const states = [];
  let cursor = 0;
  const saved = [], deleted = [];
  const modules = {
    "@/features/scheduling/components/employeeColors": employeeColors,
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
    react: { useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    } },
    "@/features/scheduling/special-availability": validation,
    "@/features/booking-flow/utils/booking": booking,
    "@/features/scheduling/utils/format": { getDateLabel: (value) => value }
  };
  for (const name of ["Button", "Modal", "TextField", "SelectField", "CheckboxField"]) modules[`@/components/ui/${name}`] = { [name]: name };
  const url = new URL("./SpecialAvailabilityModal.tsx", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  const props = {
    services: [{ id: serviceId, name: "Service", employeeIds: [employeeId, secondId, "archived"], durationMinutes: 30 }],
    employees: [{ id: employeeId, name: "First", color: "employee-violet" }, { id: secondId, name: "Second", color: "employee-teal" }, { id: "unassigned", name: "Unassigned" }, { id: "archived", name: "Archived", isArchived: true }],
    initialDate: "2030-08-09", isOpen: true, messages: messages.es, dayBlocks: [], onClose: () => {},
    onSave: async (opening) => { saved.push(opening); return true; }, onDelete: async (id) => { deleted.push(id); return true; }
  };
  let tree;
  const render = () => { cursor = 0; tree = loaded.exports.SpecialAvailabilityModal(props); };
  const nodes = (node = tree) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).filter(Boolean).flatMap((child) => nodes(child))];
  const field = (label) => nodes().find((node) => node.props?.label === label || node.props?.["aria-label"] === label);
  const button = (label) => nodes().find((node) => node.type === "Button" && (node.props.children === label || node.props["aria-label"] === label));
  const change = (label, value) => { field(label).props.onChange({ target: { value } }); render(); };
  const selectStaff = (name, checked = true) => { field(name).props.onChange({ target: { checked } }); render(); };
  const save = async () => { button(messages.es.calendar.exceptional.add).props.onClick(); await flush(); render(); };
  render();
  return { props, render, nodes, field, button, change, selectStaff, save, saved, deleted };
}

test("exceptional availability selects only active staff assigned to the chosen service and saves multiple professionals", async () => {
  const app = harness();
  const copy = messages.es.calendar.exceptional;
  assert.equal(app.nodes().filter((node) => node.type === "input" && node.props.type === "checkbox").length, 0);
  app.change(copy.service, serviceId);
  assert.deepEqual(app.nodes().filter((node) => node.type === "input" && node.props.type === "checkbox").map((node) => node.props["aria-label"]), ["First", "Second"]);
  app.selectStaff("First");
  app.selectStaff("Second");
  await app.save();
  assert.equal(app.saved.length, 1);
  assert.deepEqual(app.saved[0].employeeIds, [employeeId, secondId]);
  assert.equal(app.saved[0].date, "2030-08-09");
  assert.equal(app.field(copy.service).props.value, "");
});

test("changing service clears selections and blocked or invalid ranges cannot be saved", async () => {
  const app = harness();
  const copy = messages.es.calendar.exceptional;
  app.change(copy.service, serviceId);
  app.selectStaff("First");
  app.change(copy.service, "");
  app.change(copy.service, serviceId);
  assert.equal(app.field("First").props.checked, false);
  app.selectStaff("First");
  app.props.dayBlocks = [{ startsOn: "2030-08-09", endsOn: "2030-08-09", employeeId }];
  app.render();
  await app.save();
  assert.equal(app.saved.length, 0);
  assert.ok(app.nodes().some((node) => node.props?.role === "alert" && node.props.children === copy.blocked));
  app.props.dayBlocks = [];
  app.change(copy.end, "08:00");
  await app.save();
  assert.equal(app.saved.length, 0);
});

test("failed saves preserve the draft, while owned scheduled openings can be edited and deleted", async () => {
  const app = harness();
  const copy = messages.es.calendar.exceptional;
  app.change(copy.service, serviceId);
  app.selectStaff("First");
  app.props.onSave = async () => false;
  app.render();
  await app.save();
  assert.equal(app.field(copy.service).props.value, serviceId);
  assert.equal(app.field("First").props.checked, true);
  assert.ok(app.nodes().some((node) => node.props?.role === "alert"));
  const opening = { id: "10000000-0000-4000-8000-000000000001", serviceId, date: "2030-08-09", start: "10:00", end: "12:00", employeeIds: [employeeId] };
  app.props.services[0].specialAvailability = [opening];
  app.render();
  app.button(messages.es.actions.edit).props.onClick();
  app.render();
  assert.equal(app.field(copy.start).props.value, "10:00");
  assert.ok(app.button(messages.es.actions.save));
  app.button(messages.es.actions.delete).props.onClick();
  await flush();
  assert.deepEqual(app.deleted, [opening.id]);
});


test("professional cards preserve their full color in both checkbox states", () => {
  const app = harness();
  app.change(messages.es.calendar.exceptional.service, serviceId);
  const card = (name) => app.nodes().find((node) => node.type === "label" && node.props.children[1]?.props["aria-label"] === name);
  const first = card("First");
  const second = card("Second");
  assert.match(first.props.className, /border-employee-violet\/35 bg-employee-violet\/12/);
  assert.match(second.props.className, /border-employee-teal\/35 bg-employee-teal\/12/);
  assert.doesNotMatch(first.props.className, /opacity-|grayscale/);
  assert.match(first.props.children[0].props.children[0].props.className, /rounded-full bg-employee-violet/);
  assert.equal(app.field("First").props.type, "checkbox");
  assert.equal(app.field("First").props.checked, false);
  app.selectStaff("First");
  assert.equal(app.field("First").props.checked, true);
  assert.match(card("First").props.className, /ring-2 ring-brand\/20/);
  assert.match(card("First").props.className, /bg-employee-violet\/12/);
  app.selectStaff("First", false);
  assert.equal(app.field("First").props.checked, false);
  assert.doesNotMatch(card("First").props.className, /opacity-|grayscale/);
});
