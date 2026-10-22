import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { messages } from "../i18n/messages.ts";
import * as revenue from "../utils/statistics-revenue.ts";

const require = createRequire(import.meta.url);

function setup() {
  const states = [];
  let cursor = 0;
  const modules = {
    react: { useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    }, useRef: () => ({ current: null }) },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
    "@/features/scheduling/components/employeeColors": { employeeColorClasses: {} },
    "@/features/scheduling/utils/statistics-revenue": revenue,
    "@/features/scheduling/components/StatisticsView/AnalyticsPanel": { AnalyticsPanel: "AnalyticsPanel" },
    "@/features/scheduling/components/StatisticsView/StatusBreakdown": { StatusBreakdown: "StatusBreakdown" },
    "@/components/composed/SectionHeader": { SectionHeader: "SectionHeader" },
    "@/components/composed/PremiumFeatureCard": { PremiumFeatureCard: "PremiumFeatureCard" }
  };
  for (const name of ["Badge", "Button", "Card", "SelectField", "Pagination"]) modules[`@/components/ui/${name}`] = { [name]: name };
  const url = new URL("./StatisticsView.tsx", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, url.pathname);
  const appointments = [
    ["paid", "scheduled", "paid", 200], ["pending", "scheduled", "pending", 300],
    ["completed", "completed", "pending", 100], ["cancelled", "cancelled", "pending", 5000],
    ["rescheduled", "rescheduled", "pending", 9000], ["refunded", "completed", "refunded", 700]
  ].map(([id, appointmentStatus, paymentStatus, amount]) => ({ id, appointmentStatus, paymentStatus, revenue: amount, employeeId: "employee", serviceId: "service", date: "2026-10-22", startTime: "12:00", endTime: "12:30", customerName: id, partySize: 1 }));
  let tree;
  function render(overrides = {}) {
    cursor = 0;
    tree = loaded.exports.StatisticsView({ appointments, services: [{ id: "service", name: "Service" }], employees: [{ id: "employee", name: "Employee" }], referenceDate: "2026-10-22", messages: messages.es, ...overrides });
    return tree;
  }
  function nodes(node = tree) {
    if (!node || typeof node !== "object") return [];
    const children = typeof node.props?.children === "function" ? node.props.children(false) : node.props?.children;
    return [node, ...[children].flat(Infinity).filter((child) => child && typeof child === "object").flatMap((child) => nodes(child))];
  }
  return { render, nodes };
}

test("revenue cards link to the matching list and no longer repeat their labels in badges", () => {
  const app = setup();
  const previousWindow = globalThis.window;
  globalThis.window = { requestAnimationFrame: (callback) => callback() };
  try {
    assert.match(app.render().props.className, /\[overflow-anchor:none\]/);
    const estimatedCard = app.nodes().find((node) => node.type === "Card" && node.key === "estimated");
    const pendingCard = app.nodes().find((node) => node.type === "Card" && node.key === "pending");
    assert.ok(estimatedCard);
    const title = app.nodes(estimatedCard).find((node) => node.type === "p" && node.props.children === messages.es.statistics.cards.estimatedRevenue);
    assert.match(title.props.className, /text-brand-strong/);
    assert.match(JSON.stringify(estimatedCard.props.children), /600/);
    assert.match(JSON.stringify(pendingCard.props.children), /400/);
    assert.equal(app.nodes(estimatedCard).some((node) => node.type === "Badge"), false);
    const viewButtons = app.nodes().filter((node) => node.type === "Button" && node.props.children === messages.es.statistics.viewAppointments);
    assert.ok(viewButtons.length > 0);
    for (const button of viewButtons) {
      assert.match(button.props.className, /\bbg-surface-strong\b/);
      assert.match(button.props.className, /hover:bg-brand-soft/);
      assert.match(button.props.className, /hover:!text-brand-strong/);
    }
    app.nodes(pendingCard).find((node) => node.type === "Button").props.onClick();
    app.render();
    const filter = app.nodes().find((node) => node.type === "SelectField" && node.props.label === messages.es.statistics.revenueFilter);
    assert.equal(filter.props.value, "pending");
    const customerCells = app.nodes().filter((node) => node.type === "td" && node.props.className.includes("font-semibold")).map((node) => node.props.children);
    assert.deepEqual(customerCells, ["pending", "completed"]);
    const tableHeaders = app.nodes().filter((node) => node.type === "th").map((node) => node.props.children);
    assert.ok(tableHeaders.includes("Pago"));
    assert.ok(tableHeaders.includes("Estado"));
    filter.props.onChange({ target: { value: "paid" } });
    app.render();
    assert.deepEqual(app.nodes().filter((node) => node.type === "td" && node.props.className.includes("font-semibold")).map((node) => node.props.children), ["paid"]);
  } finally { globalThis.window = previousWindow; }
});

test("employee and period filters recalculate the amounts and handle empty results", () => {
  const app = setup();
  app.render();
  app.nodes().find((node) => node.type === "SelectField" && node.props.label === messages.es.statistics.periodFilter).props.onChange({ target: { value: "lastMonth" } });
  app.render();
  const estimated = app.nodes().find((node) => node.type === "Card" && node.key === "estimated");
  assert.match(JSON.stringify(estimated.props.children), /\$.*0/);
  assert.equal(app.nodes().filter((node) => node.type === "td").length, 0);
  assert.equal(app.nodes().filter((node) => node.type === "AnalyticsPanel").length, 6);
});

test("booking lifecycle and payment status have separate panels with disjoint payment counts", () => {
  const app = setup();
  app.render();
  const panels = app.nodes().filter((node) => node.type === "AnalyticsPanel");
  assert.deepEqual(panels.slice(2, 5).map((node) => node.props.title), [
    messages.es.statistics.panels.statusBreakdown,
    messages.es.statistics.panels.paymentBreakdown,
    messages.es.statistics.panels.employeePerformance
  ]);
  const lifecycle = panels.find((node) => node.props.title === messages.es.statistics.panels.statusBreakdown);
  const payment = panels.find((node) => node.props.title === messages.es.statistics.panels.paymentBreakdown);
  assert.ok(lifecycle);
  assert.ok(payment);
  const rows = payment.props.children(false).props.rows;
  assert.deepEqual(rows.map((row) => [row.id, row.value]), [["paid", 1], ["pending", 2], ["cancelled", 1], ["refunded", 1]]);
  assert.equal(rows.reduce((sum, row) => sum + row.value, 0), 5);
  assert.equal(rows.reduce((sum, row) => sum + row.percentage, 0), 100);
  assert.equal(payment.props.children(true).props.isExpanded, true);
  assert.equal(lifecycle.props.children(false).props.rows.find((row) => row.id === "scheduled").value, 2);
});

test("the period table stays open and paginates both layouts without changing totals", () => {
  const app = setup();
  const appointments = Array.from({ length: 45 }, (_, index) => ({
    id: `booking-${index}`, customerName: `Customer ${index}`, date: "2026-10-22", startTime: "12:00", endTime: "12:30",
    employeeId: "employee", serviceId: "service", appointmentStatus: "scheduled", paymentStatus: "paid", revenue: 100, partySize: 1
  }));
  const render = (list = appointments) => app.render({ appointments: list });
  const pagination = () => app.nodes().find((node) => node.type === "Pagination");
  const rows = () => app.nodes().filter((node) => node.type === "td" && node.props.className.includes("font-semibold"));
  render();
  const metricsGrid = app.nodes().find((node) => node.type === "section" && node.props.className.includes("min-[900px]:grid-cols-2"));
  assert.ok(metricsGrid);
  assert.match(metricsGrid.props.className, /2xl:grid-cols-3/);
  const desktopTable = app.nodes().find((node) => node.type === "div" && node.props.className?.includes("overflow-x-auto"));
  assert.match(desktopTable.props.className, /hidden min-w-0.*min-\[900px\]:block/);
  assert.ok(app.nodes().some((node) => node.type === "div" && node.props.className?.includes("min-[900px]:hidden")));
  assert.equal(app.nodes().filter((node) => node.type === "AnalyticsPanel").length, 6);
  assert.equal(app.nodes().some((node) => node.type === "AnalyticsPanel" && node.props.title === messages.es.statistics.panels.latestAppointments), false);
  assert.ok(app.nodes().some((node) => node.type === "h2" && node.props.children === messages.es.statistics.panels.latestAppointments));
  assert.equal(rows().length, 20);
  assert.equal(pagination().props.totalItems, 45);
  assert.equal(app.nodes().filter((node) => node.type === "p" && /^Customer /.test(node.props.children)).length, 20);
  pagination().props.onPageChange(3); render();
  assert.equal(rows().length, 5);
  assert.equal(rows()[0].props.children, "Customer 40");
  assert.equal(pagination().props.totalItems, 45);
  render(appointments.slice(0, 3));
  assert.equal(pagination().props.currentPage, 1);
  assert.equal(rows().length, 3);
  render();
  app.nodes().find((node) => node.type === "SelectField" && node.props.label === messages.es.statistics.perPage).props.onChange({ target: { value: "10" } });
  render();
  assert.equal(pagination().props.currentPage, 1);
  assert.equal(rows().length, 10);
  pagination().props.onPageChange(2); render();
  app.nodes().find((node) => node.type === "SelectField" && node.props.label === messages.es.statistics.revenueFilter).props.onChange({ target: { value: "pending" } });
  render();
  assert.equal(pagination().props.currentPage, 1);
  assert.equal(rows().length, 0);
  assert.equal(pagination().props.totalItems, 0);
});

test("the sixth panel ranks weekdays using the selected period and employee and excludes cancelled and rescheduled bookings", () => {
  const app = setup();
  const appointments = [
    ["2026-10-19", "employee", "scheduled", 2],
    ["2026-10-19", "other", "completed", 3],
    ["2026-10-22", "employee", "scheduled", 1],
    ["2026-10-19", "employee", "cancelled", 10],
    ["2026-10-22", "employee", "rescheduled", 10]
  ].map(([date, employeeId, appointmentStatus, partySize], index) => ({ id: String(index), date, employeeId, appointmentStatus, partySize, startTime: "12:00", endTime: "12:30", serviceId: "service", paymentStatus: "paid", revenue: 100 }));
  const render = () => app.render({ appointments });
  const panel = () => app.nodes().find((node) => node.type === "AnalyticsPanel" && node.props.title === messages.es.statistics.panels.weekdayDistribution);
  const day = (label) => app.nodes(panel()).find((node) => node.props.label === label);
  render();
  assert.equal(day(messages.es.days.monday).props.value, "2 turnos");
  assert.equal(day(messages.es.days.monday).props.helper, "5 personas");
  assert.equal(day(messages.es.days.thursday).props.value, "1 turnos");
  app.nodes().find((node) => node.type === "SelectField" && node.props.label === messages.es.statistics.employeeFilter).props.onChange({ target: { value: "employee" } });
  render();
  assert.equal(day(messages.es.days.monday).props.value, "1 turnos");
  app.nodes().find((node) => node.type === "SelectField" && node.props.label === messages.es.statistics.periodFilter).props.onChange({ target: { value: "today" } });
  render();
  assert.equal(day(messages.es.days.monday).props.value, "0 turnos");
  assert.equal(day(messages.es.days.thursday).props.value, "1 turnos");
  app.nodes().find((node) => node.type === "SelectField" && node.props.label === messages.es.statistics.periodFilter).props.onChange({ target: { value: "lastMonth" } });
  render();
  assert.equal(panel().props.children(false).props.message, messages.es.statistics.empty);
});
