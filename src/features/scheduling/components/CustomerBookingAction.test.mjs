import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { messages } from "../i18n/messages.ts";

const require = createRequire(import.meta.url);
function harness({ mutationResult = true } = {}) {
  const states = [], refs = [], effects = [], requests = [], calls = [];
  let cursor = 0, refCursor = 0, tree;
  const actions = Object.fromEntries(["deleteAppointment", "markAppointmentPaid", "markAppointmentNoShow", "rescheduleAppointment"].map((name) => [name, async (...args) => { calls.push([name, ...args]); return mutationResult; }]));
  const modules = {
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
    react: { useState: (initial) => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (value) => { states[i] = typeof value === "function" ? value(states[i]) : value; }]; }, useRef: (initial) => { const i = refCursor++; return refs[i] ??= { current: initial }; }, useEffect: (fn) => effects.push(fn), useCallback: (fn) => fn },
    "@/features/scheduling/components/CalendarView": { AppointmentCard: "appointment-card" },
    "@/features/scheduling/components/SchedulingProvider": { useScheduling: () => actions },
    "@/lib/networking/endpoints/scheduling": { loadSchedulingSnapshot: (options) => new Promise((resolve, reject) => requests.push({ options, resolve, reject })) }
  };
  const url = new URL("./CustomerBookingAction.tsx", import.meta.url), loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, url.pathname);
  function render() { cursor = 0; refCursor = 0; effects.length = 0; tree = loaded.exports.CustomerBookingAction({ businessId: "business", bookingId: "booking", messages: messages.es, children: "Booking details", onModalStateChange: (open) => calls.push(open), onClosed: (changed) => calls.push(changed ? "refresh" : "closed-without-changes") }); }
  render(); effects[0]();
  return { render, effects, requests, calls, trigger: () => tree.props.children[0], error: () => tree.props.children[1] };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
const snapshot = { businessId: "business", appointments: [{ id: "booking", serviceId: "service", employeeId: "employee", revenue: 100 }], employees: [{ id: "employee", name: "Professional" }], services: [{ id: "service", name: "Consultation" }], businessDayBlocks: [] };

test("clickable reservation loads fresh calendar data and reuses its modal and all mutation actions", async () => {
  const app = harness();
  assert.equal(app.requests.length, 0);
  assert.match(app.trigger().props.className, /cursor-pointer/);
  assert.match(app.trigger().props.className, /hover:bg-brand-soft/);
  app.trigger().props.onClick(); app.render(); assert.equal(app.trigger().props.disabled, true);
  assert.deepEqual(app.requests[0].options, { scope: "calendar" });
  app.requests[0].resolve(snapshot); await flush(); app.render();
  const card = app.trigger(); assert.equal(card.type, "appointment-card"); assert.equal(card.props.defaultOpen, true);
  assert.equal(card.props.appointment.revenue, 100); assert.equal(card.props.serviceName, "Consultation");
  await card.props.onMarkAppointmentPaid("booking", 0, "Insurance");
  await card.props.onDeleteAppointment("booking", "Cancelled");
  await card.props.onMarkAppointmentNoShow("booking");
  await card.props.onRescheduleAppointment("booking", "2026-11-06", "employee", "10:00", "10:30");
  assert.deepEqual(app.calls.find((call) => Array.isArray(call) && call[0] === "markAppointmentPaid"), ["markAppointmentPaid", "booking", 0, "Insurance"]);
  assert.equal(app.calls.filter(Array.isArray).length, 4);
  card.props.onModalStateChange(false); app.render(); assert.equal(app.trigger().type, "button"); assert.ok(app.calls.includes("refresh"));
});

test("failed, removed and foreign-business reservations stay in history and can be retried", async () => {
  for (const result of [null, { ...snapshot, businessId: "other" }, { ...snapshot, appointments: [] }]) {
    const app = harness(); app.trigger().props.onClick();
    if (result) app.requests[0].resolve(result); else app.requests[0].reject(new Error("offline"));
    await flush(); app.render(); assert.equal(app.trigger().type, "button"); assert.equal(app.error().props.role, "alert"); assert.ok(!app.calls.includes(true));
    app.trigger().props.onClick(); assert.equal(app.requests.length, 2);
  }
});

test("late booking loads after history unmount do not open a modal", async () => {
  const app = harness(); const cleanup = app.effects[1](); app.trigger().props.onClick(); cleanup();
  app.requests[0].resolve(snapshot); await flush(); app.render(); assert.equal(app.trigger().type, "button"); assert.ok(!app.calls.includes(true));
});


test("closing without a successful mutation does not request a history refresh", async () => {
  for (const attemptMutation of [false, true]) {
    const app = harness({ mutationResult: false }); app.trigger().props.onClick();
    app.requests[0].resolve(snapshot); await flush(); app.render();
    if (attemptMutation) assert.equal(await app.trigger().props.onMarkAppointmentPaid("booking", 0, "Insurance"), false);
    app.trigger().props.onModalStateChange(false); app.render();
    assert.ok(app.calls.includes("closed-without-changes")); assert.ok(!app.calls.includes("refresh"));
  }
});


test("pending booking remains highlighted with an accessible spinner until success or failure", async () => {
  for (const succeeds of [true, false]) {
    const app = harness();
    assert.match(app.trigger().props.className, /border-subtle bg-input/);
    assert.equal(app.trigger().props.children[1], null);
    app.trigger().props.onClick(); app.render();
    const pending = app.trigger();
    assert.equal(pending.props["aria-busy"], true);
    assert.equal(pending.props.disabled, true);
    assert.match(pending.props.className, /border-brand bg-brand-soft ring-2/);
    assert.doesNotMatch(pending.props.className, /disabled:opacity/);
    assert.equal(pending.props.children[1].props.role, "status");
    assert.match(pending.props.children[1].props.children[0].props.children.props.className, /animate-spin/);
    assert.equal(pending.props.children[1].props.children[1].props.children, messages.es.customers.history.loading);
    if (succeeds) app.requests[0].resolve(snapshot); else app.requests[0].reject(new Error("offline"));
    await flush(); app.render();
    const trigger = succeeds ? app.trigger().props.renderTrigger(() => {}) : app.trigger();
    assert.equal(trigger.props["aria-busy"], false);
    assert.equal(trigger.props.disabled, false);
    assert.equal(trigger.props.children[1], null);
    assert.match(trigger.props.className, /border-subtle bg-input/);
  }
});
