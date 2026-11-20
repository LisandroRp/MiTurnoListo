import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { messages } from "../../scheduling/i18n/messages.ts";

const require = createRequire(import.meta.url);
function calendar() {
  let isOpen = false;
  const selected = [];
  const slot = { date: "2026-11-26", startTime: "09:00", endTime: "09:30", remainingCapacity: 1, employeeAvailability: [] };
  const props = {
    messages: messages.es, locale: "es-AR", monthDate: new Date(2026, 10, 1),
    slots: [slot], selectedDate: slot.date, selectedStartTime: null,
    onMonthChange() {}, onSelectDate(date) { props.selectedDate = date; },
    onSelectSlot(value) { selected.push(value); props.selectedStartTime = value.startTime; }
  };
  const modules = {
    react: { useState: () => [isOpen, (value) => { isOpen = value; }], useEffect() {} },
    "@/components/ui/Button": { Button: "Button" },
    "@/components/ui/Card": { Card: "Card" },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
    "@/features/booking-flow/utils/booking": {
      getMonthGrid: () => [new Date(2026, 10, 26)],
      toDateKey: () => slot.date,
      formatMonthLabel: () => "noviembre de 2026",
      formatLongDate: () => "jueves, 26 de noviembre"
    }
  };
  const url = new URL("./AvailabilityCalendar.tsx", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, url.pathname);
  const nodes = (node) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  const render = () => loaded.exports.AvailabilityCalendar(props);
  return { props, selected, slot, render, nodes };
}

test("mobile times open centered and selecting a slot leaves its date and complete time range below the calendar", () => {
  const previousWindow = globalThis.window;
  globalThis.window = { innerWidth: 390 };
  try {
    const app = calendar();
    let tree = app.render();
    assert.equal(app.nodes(tree).some((node) => node.props?.role === "status"), false);
    app.nodes(tree).find((node) => node.type === "button").props.onClick();
    tree = app.render();
    const overlay = app.nodes(tree).find((node) => node.props?.className?.includes("fixed inset-0"));
    assert.match(overlay.props.className, /place-items-center/);
    const panel = overlay.props.children;
    assert.doesNotMatch(panel.props.className, /mt-auto/);
    assert.match(panel.props.className, /max-h-\[85dvh\].*overflow-y-auto/);
    app.nodes(panel).find((node) => node.type?.name === "AvailabilityHourList").props.onSelectSlot(app.slot);
    tree = app.render();
    assert.equal(app.nodes(tree).some((node) => node.props?.className?.includes("fixed inset-0")), false);
    assert.deepEqual(app.selected, [app.slot]);
    const summary = app.nodes(tree).find((node) => node.props?.role === "status");
    assert.match(summary.props.className, /lg:hidden/);
    assert.equal(summary.props["aria-live"], "polite");
    const text = JSON.stringify(summary);
    assert.match(text, /jueves, 26 de noviembre/);
    assert.match(text, /09:00/);
    assert.match(text, /09:30/);
    app.props.selectedDate = "2026-11-27";
    assert.equal(app.nodes(app.render()).some((node) => node.props?.role === "status"), false);
    app.props.selectedDate = app.slot.date;
    app.props.selectedStartTime = null;
    assert.equal(app.nodes(app.render()).some((node) => node.props?.role === "status"), false);
  } finally {
    globalThis.window = previousWindow;
  }
});
