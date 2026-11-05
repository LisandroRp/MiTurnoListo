import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { messages } from "../i18n/messages.ts";

const require = createRequire(import.meta.url);
function harness() {
  const states = [], effects = [], requests = [], calls = [];
  let cursor = 0, tree;
  const root = { closest: () => ({ setAttribute: (...args) => calls.push(args) }), querySelector: () => ({ focus: () => calls.push("close-focus") }), querySelectorAll: () => [] };
  const modules = {
    react: { useState: (initial) => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (value) => { states[i] = typeof value === "function" ? value(states[i]) : value; }]; }, useRef: (initial) => ({ current: initial === null ? root : initial }), useId: () => "history-title", useEffect: (callback) => effects.push(callback) },
    "@/lib/networking/endpoints/customers": { getCustomerBookings: (...args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })) },
    "@/components/ui/Badge": { Badge: "badge" }, "@/components/ui/Button": { Button: "button" },
    "@/components/ui/Modal": { Modal: "modal" }, "@/components/ui/Pagination": { Pagination: "pagination" },
    "./LoadingDotsText": { LoadingDotsText: "loading" }, "./CustomerBookingAction": { CustomerBookingAction: "booking-action" }
  };
  const url = new URL("./CustomerBookingHistory.tsx", import.meta.url), loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, url.pathname);
  const customer = { id: "customer", fullName: "Test Customer", email: "test@example.com" };
  function render() { cursor = 0; effects.length = 0; tree = loaded.exports.CustomerBookingHistory({ businessId: "business", customer, messages: messages.es, onClose: () => calls.push("close") }); }
  function nodes(type) { const found = []; function walk(node) { if (!node || typeof node !== "object") return; if (node.type === type) found.push(node); const children = node.props?.children; (Array.isArray(children) ? children.flat(Infinity) : [children]).forEach(walk); } walk(tree); return found; }
  render();
  return { render, nodes, effects, requests, calls, text: () => JSON.stringify(tree), trigger: () => loaded.exports.CustomerBookingHistoryButton({ customer, messages: messages.es, onClick: () => calls.push("open") }) };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("customer history button opens the modal; loading, grouped results, pagination and close work", async () => {
  const app = harness();
  assert.equal(app.trigger().props["aria-label"], "Ver reservas de Test Customer"); app.trigger().props.onClick(); assert.ok(app.calls.includes("open"));
  assert.equal(app.nodes("loading").length, 1);
  const cleanup = app.effects[0]();
  assert.deepEqual(app.requests[0].args.slice(0, 3), ["business", "customer", 1]);
  app.requests[0].resolve({ data: [true, false].map((isUpcoming, i) => ({ id: String(i), isUpcoming, startsAt: "2026-11-05T15:00:00Z", endsAt: "2026-11-05T15:30:00Z", serviceName: "Consultation", employeeName: "Professional", appointmentStatus: i ? "cancelled" : "scheduled", paymentStatus: i ? "paid" : "pending" })), meta: { currentPage: 1, total: 14, perPage: 10, timeZone: "America/Argentina/Buenos_Aires" } });
  await flush(); app.render();
  assert.equal(app.nodes("li").length, 2);
  assert.deepEqual(app.nodes("h3").map((node) => node.props.children), ["Próximas reservas", "Reservas anteriores"]);
  assert.ok(app.text().includes("12:00"));
  assert.ok(app.text().includes("Jueves"));
  assert.equal(app.nodes("booking-action")[0].props.bookingId, "0");
  app.nodes("booking-action")[0].props.onModalStateChange(true);
  app.nodes("booking-action")[0].props.onModalStateChange(false);
  assert.ok(app.text().includes("Cancelado")); assert.ok(app.text().includes("Pagado"));
  app.nodes("pagination")[0].props.onPageChange(2); app.render(); assert.equal(app.nodes("loading").length, 1);
  app.effects[0](); assert.equal(app.requests[1].args[2], 2);
  app.nodes("button")[0].props.onClick(); assert.ok(app.calls.includes("close"));
  cleanup(); assert.equal(app.requests[0].args[3].aborted, true);
});

test("history supports retry and empty state and ignores responses after unmount", async () => {
  const app = harness(); app.effects[0](); app.requests[0].reject(new Error("offline")); await flush(); app.render();
  assert.equal(app.nodes("div").some((node) => node.props.role === "alert"), true);
  app.nodes("button").find((node) => node.props.children === "Reintentar").props.onClick(); app.render();
  const cleanup = app.effects[0](); app.requests[1].resolve({ data: [], meta: { currentPage: 1, total: 0, perPage: 10, timeZone: "UTC" } });
  await flush(); app.render(); assert.ok(app.text().includes("Este cliente todavía no tiene reservas.")); assert.equal(app.nodes("pagination").length, 0); cleanup();
  const stale = harness(); const dispose = stale.effects[0](); dispose(); stale.requests[0].resolve({ data: [] }); await flush(); stale.render(); assert.equal(stale.nodes("loading").length, 1);
});

test("history labels its dialog, supports Escape and restores focus to its trigger", () => {
  const originalDocument = globalThis.document, originalElement = globalThis.HTMLElement;
  const listeners = new Map();
  class Element { focus() { focused = true; } }
  let focused = false;
  globalThis.HTMLElement = Element;
  globalThis.document = { activeElement: new Element(), addEventListener: (event, fn) => listeners.set(event, fn), removeEventListener: (event) => listeners.delete(event) };
  try {
    const app = harness(); const cleanup = app.effects[1]();
    assert.ok(app.calls.includes("close-focus")); assert.ok(app.calls.some((call) => Array.isArray(call) && call[0] === "aria-labelledby"));
    listeners.get("keydown")({ key: "Escape", preventDefault() {} }); assert.ok(app.calls.includes("close"));
    cleanup(); assert.equal(focused, true); assert.equal(listeners.size, 0);
  } finally { globalThis.document = originalDocument; globalThis.HTMLElement = originalElement; }
});


test("closing a booking keeps the history visible and successful edits refresh silently even if the refresh fails", async () => {
  const app = harness(); app.effects[0]();
  const response = { data: [{ id: "booking", isUpcoming: true, startsAt: "2026-11-05T15:00:00Z", endsAt: "2026-11-05T15:30:00Z", serviceName: "Consultation", employeeName: "Professional", appointmentStatus: "scheduled", paymentStatus: "pending" }], meta: { currentPage: 1, total: 1, perPage: 10, timeZone: "America/Argentina/Buenos_Aires" } };
  app.requests[0].resolve(response); await flush(); app.render();
  app.nodes("booking-action")[0].props.onClosed(false); app.render();
  assert.equal(app.nodes("loading").length, 0); assert.equal(app.nodes("li").length, 1);
  assert.equal(app.requests.length, 1);
  app.nodes("booking-action")[0].props.onClosed(true); app.render(); app.effects[0]();
  assert.equal(app.nodes("loading").length, 0); assert.equal(app.nodes("li").length, 1);
  app.requests[1].resolve({ ...response, data: [{ ...response.data[0], paymentStatus: "paid" }] });
  await flush(); app.render(); assert.ok(app.text().includes("Pagado"));
  app.nodes("booking-action")[0].props.onClosed(true); app.render(); app.effects[0]();
  app.requests[2].reject(new Error("offline")); await flush(); app.render();
  assert.equal(app.nodes("loading").length, 0); assert.equal(app.nodes("li").length, 1);
  assert.ok(app.text().includes("Pagado")); assert.ok(app.text().includes("Reintentar"));
});
