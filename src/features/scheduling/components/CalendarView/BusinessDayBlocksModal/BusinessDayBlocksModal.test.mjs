import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as dayBlocks from "../../../utils/day-blocks.ts";
import { messages } from "../../../i18n/messages.ts";

const require = createRequire(import.meta.url);
const copy = messages.es.calendar;
const flush = () => new Promise((resolve) => setImmediate(resolve));
function harness(target = "employee") {
  const states = [], saved = [], deleted = [];
  let cursor = 0, tree;
  const modules = {
    react: { useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    } },
    "@/features/scheduling/utils/day-blocks": dayBlocks,
    "@/features/scheduling/utils/format": { getDateLabel: (date) => date }
  };
  for (const name of ["Button", "Modal", "TextField", "SelectField", "TextAreaField", "SegmentedControl"]) modules[`@/components/ui/${name}`] = { [name]: name };
  const url = new URL("./BusinessDayBlocksModal.tsx", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  const props = {
    target, isOpen: true, messages: messages.es,
    employees: [{ id: "first", name: "First" }, { id: "archived", name: "Archived", isArchived: true }],
    dayBlocks: [
      { id: "business", startsOn: "2099-08-09", endsOn: "2099-08-09", reason: "Business only" },
      { id: "employee", employeeId: "first", startsOn: "2099-08-09", endsOn: "2099-08-09", startTime: "14:00", endTime: "16:00", reason: "Employee only" }
    ],
    onClose: () => {}, onSave: async (block) => { saved.push(block); return true; }, onDelete: async (id) => { deleted.push(id); return true; }
  };
  const render = () => { cursor = 0; tree = loaded.exports.BusinessDayBlocksModal(props); };
  const nodes = (node = tree) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).filter(Boolean).flatMap((child) => nodes(child))];
  const field = (name) => nodes().find((node) => node.props?.name === name);
  const button = (text) => nodes().find((node) => node.type === "Button" && node.props.children === text);
  const change = (name, value) => { field(name).props.onChange({ target: { value } }); render(); };
  const mode = (value) => { nodes().find((node) => node.type === "SegmentedControl").props.onChange(value); render(); };
  const save = async () => { button(field("blocked-start-time") ? copy.blockHours : copy.blockDay).props.onClick(); await flush(); render(); };
  render();
  return { props, nodes, field, button, change, mode, save, saved, deleted, render };
}

test("business and professional dialogs have distinct titles, forms and lists without target selectors or tabs", () => {
  for (const target of ["business", "employee"]) {
    const app = harness(target);
    assert.ok(app.nodes().some((node) => node.type === "h2" && node.props.children === (target === "business" ? copy.blockedBusinessTitle : copy.blockedEmployeeTitle)));
    assert.equal(Boolean(app.field("blocked-day-employee")), target === "employee");
    assert.equal(Boolean(app.nodes().find((node) => node.type === "SegmentedControl")), target === "employee");
    assert.equal(app.field("blocked-day-target"), undefined);
    assert.equal(app.nodes().filter((node) => node.props?.["aria-pressed"] !== undefined).length, 0);
    const reasons = app.nodes().filter((node) => node.type === "p").map((node) => node.props.children);
    assert.ok(reasons.includes(target === "business" ? "Business only" : "Employee only"));
    assert.ok(!reasons.includes(target === "business" ? "Employee only" : "Business only"));
  }
});

test("hours use the selected date, a start time and duration instead of a date range", async () => {
  const app = harness();
  assert.deepEqual(app.field("blocked-day-employee").props.options.map((option) => option.value), ["", "first"]);
  app.change("blocked-day-employee", "first");
  app.change("blocked-day-start", "2099-08-09");
  app.change("blocked-day-end", "2099-08-20");
  app.mode("hours");
  assert.equal(app.field("blocked-day-end"), undefined);
  assert.equal(app.field("blocked-day-start").props.value, "2099-08-09");
  app.change("blocked-start-time", "14:00");
  app.change("blocked-duration-hours", "2");
  app.change("blocked-duration-minutes", "30");
  await app.save();
  assert.equal(app.saved.length, 1);
  assert.deepEqual({ ...app.saved[0], id: "id" }, { id: "id", employeeId: "first", startsOn: "2099-08-09", endsOn: "2099-08-09", startTime: "14:00", endTime: "16:30", reason: copy.blockedEmployeeDefaultReason });
});

test("full-day mode preserves date ranges and clears hidden hourly data from the saved block", async () => {
  const app = harness();
  app.change("blocked-day-employee", "first");
  app.change("blocked-day-start", "2099-08-09");
  app.mode("hours");
  app.change("blocked-start-time", "14:00");
  app.mode("day");
  app.change("blocked-day-end", "2099-08-11");
  await app.save();
  assert.equal(app.saved[0].endsOn, "2099-08-11");
  assert.equal(app.saved[0].startTime, null);
  assert.equal(app.saved[0].endTime, null);
  const business = harness("business");
  business.change("blocked-day-start", "2099-08-09");
  business.change("blocked-day-end", "2099-08-09");
  await business.save();
  assert.equal(business.saved[0].employeeId, null);
  assert.equal(business.saved[0].reason, copy.blockedDayDefaultReason);
});

test("invalid durations, missing or archived staff and past dates cannot be saved", async () => {
  const app = harness();
  await app.save();
  assert.equal(app.saved.length, 0);
  app.change("blocked-day-employee", "archived");
  await app.save();
  assert.equal(app.saved.length, 0);
  app.change("blocked-day-employee", "first");
  app.change("blocked-day-start", "2099-08-09");
  app.mode("hours");
  for (const [start, hours, minutes] of [["", "1", "0"], ["14:00", "0", "0"], ["23:30", "1", "0"], ["14:00", "-1", "0"], ["14:00", "1.5", "0"]]) {
    app.change("blocked-start-time", start);
    app.change("blocked-duration-hours", hours);
    app.change("blocked-duration-minutes", minutes);
    await app.save();
    assert.ok(app.nodes().some((node) => node.props?.role === "alert" && node.props.children === copy.blockedHoursInvalid));
  }
  app.change("blocked-start-time", "14:00");
  app.change("blocked-duration-hours", "1");
  app.change("blocked-day-start", "2020-01-01");
  await app.save();
  assert.equal(app.saved.length, 0);
});

test("pending saves disable the fields and failed saves retain the complete draft with feedback", async () => {
  const app = harness();
  app.change("blocked-day-employee", "first");
  app.change("blocked-day-start", "2099-08-09");
  app.mode("hours");
  app.change("blocked-start-time", "14:00");
  app.change("blocked-duration-hours", "1");
  let finish;
  app.props.onSave = () => new Promise((resolve) => { finish = resolve; });
  app.render();
  app.button(copy.blockHours).props.onClick();
  app.render();
  assert.equal(app.nodes().find((node) => node.type === "fieldset").props.disabled, true);
  finish(false);
  await flush(); app.render();
  assert.equal(app.field("blocked-start-time").props.value, "14:00");
  assert.ok(app.nodes().some((node) => node.props?.role === "alert" && node.props.children === copy.blockedSaveFailed));
  app.props.onSave = async () => { throw new Error("Unavailable"); };
  app.render();
  await app.save();
  assert.equal(app.field("blocked-start-time").props.value, "14:00");
  assert.equal(app.nodes().find((node) => node.type === "fieldset").props.disabled, false);
});

test("professional block list shows hours and supports deletion, while empty lists have feedback", async () => {
  const app = harness();
  assert.ok(app.nodes().some((node) => node.type === "p" && JSON.stringify(node.props.children).includes("14:00–16:00")));
  app.button(messages.es.actions.delete).props.onClick();
  await flush();
  assert.deepEqual(app.deleted, ["employee"]);
  app.props.dayBlocks = [];
  app.render();
  assert.ok(app.nodes().some((node) => node.props?.children === copy.blockedDaysEmpty));
});


test("both dialogs start empty and disabled until all required full-day fields are valid", () => {
  for (const target of ["business", "employee"]) {
    const app = harness(target);
    const disabled = () => app.button(copy.blockDay).props.disabled;
    assert.equal(app.field("blocked-day-start").props.value, "");
    assert.equal(app.field("blocked-day-end").props.value, "");
    assert.equal(disabled(), true);
    app.change("blocked-day-start", "2099-08-09");
    assert.equal(disabled(), true);
    app.change("blocked-day-end", "2099-08-10");
    assert.equal(disabled(), target === "employee");
    if (target === "employee") {
      app.change("blocked-day-employee", "archived");
      assert.equal(disabled(), true);
      app.change("blocked-day-employee", "first");
      assert.equal(disabled(), false);
    }
    app.change("blocked-day-end", "2099-08-08");
    assert.equal(disabled(), true);
    app.change("blocked-day-end", "2099-08-10");
    assert.equal(disabled(), false);
    app.change("blocked-day-start", "2099-02-30");
    assert.equal(disabled(), true);
    app.change("blocked-day-start", "2020-01-01");
    app.change("blocked-day-end", "2020-01-01");
    assert.equal(disabled(), true);
  }
});

test("hourly blocking requires a date, active professional, start time and positive same-day duration", () => {
  const app = harness();
  app.mode("hours");
  const disabled = () => app.button(copy.blockHours).props.disabled;
  assert.equal(app.field("blocked-start-time").props.value, "");
  assert.equal(app.field("blocked-duration-hours").props.value, "0");
  assert.equal(app.field("blocked-duration-minutes").props.value, "0");
  assert.equal(disabled(), true);
  app.change("blocked-day-employee", "first");
  app.change("blocked-day-start", "2099-08-09");
  app.change("blocked-start-time", "14:00");
  assert.equal(disabled(), true);
  app.change("blocked-duration-minutes", "30");
  assert.equal(disabled(), false);
  app.change("blocked-start-time", "23:45");
  assert.equal(disabled(), true);
  app.change("blocked-start-time", "23:30");
  assert.equal(disabled(), false);
  app.change("blocked-day-start", "");
  assert.equal(disabled(), true);
});

test("closing and reopening clears every field, hourly mode and errors even if the component stays mounted", async () => {
  for (const target of ["business", "employee"]) {
    const app = harness(target);
    app.change("blocked-day-start", "2099-08-09");
    app.change("blocked-day-end", "2099-08-10");
    app.change("blocked-day-reason", "Private absence");
    if (target === "employee") {
      app.change("blocked-day-employee", "first");
      app.mode("hours");
      app.change("blocked-start-time", "14:00");
      app.change("blocked-duration-hours", "2");
      app.change("blocked-duration-minutes", "30");
    }
    app.props.onSave = async () => false;
    app.render();
    await app.save();
    assert.ok(app.nodes().some((node) => node.props?.role === "alert"));
    let closed = false;
    app.props.onClose = () => { closed = true; };
    app.render();
    app.nodes().find((node) => node.props?.["aria-label"] === messages.es.actions.closeMenu).props.onClick();
    assert.equal(closed, true);
    app.props.isOpen = false;
    app.render();
    app.props.isOpen = true;
    app.render();
    assert.equal(app.field("blocked-day-start").props.value, "");
    assert.equal(app.field("blocked-day-end").props.value, "");
    assert.equal(app.field("blocked-day-reason").props.value, "");
    assert.equal(app.button(copy.blockDay).props.disabled, true);
    assert.equal(app.nodes().some((node) => node.props?.role === "alert"), false);
    if (target === "employee") {
      assert.equal(app.field("blocked-day-employee").props.value, "");
      assert.equal(app.nodes().find((node) => node.type === "SegmentedControl").props.value, "day");
      app.mode("hours");
      assert.equal(app.field("blocked-start-time").props.value, "");
      assert.equal(app.field("blocked-duration-hours").props.value, "0");
      assert.equal(app.field("blocked-duration-minutes").props.value, "0");
      assert.equal(app.button(copy.blockHours).props.disabled, true);
    }
  }
});

test("successful saves reset the full draft and leave the action disabled", async () => {
  for (const target of ["business", "employee"]) {
    const app = harness(target);
    app.change("blocked-day-start", "2099-08-09");
    app.change("blocked-day-end", "2099-08-09");
    if (target === "employee") app.change("blocked-day-employee", "first");
    assert.equal(app.button(copy.blockDay).props.disabled, false);
    await app.save();
    assert.equal(app.saved.length, 1);
    assert.equal(app.field("blocked-day-start").props.value, "");
    assert.equal(app.field("blocked-day-end").props.value, "");
    assert.equal(app.button(copy.blockDay).props.disabled, true);
  }
});
