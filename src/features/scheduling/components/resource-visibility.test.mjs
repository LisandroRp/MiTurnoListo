import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as planLimits from "../plan-limits.ts";
import * as numericLimits from "../service-numeric-limits.ts";
import * as format from "../utils/format.ts";
import * as cancellation from "../service-cancellation-policy.ts";
import * as fields from "../service-custom-fields.ts";
import { messages } from "../i18n/messages.ts";

const require = createRequire(import.meta.url);
const entity = (id, isVisible = true) => ({ id, name: `Name ${id}`, role: "Professional", description: "", initials: "N", imageUrl: "", color: "blue", isArchived: false, isVisible, price: 100, deposit: 0, durationMinutes: 60, capacity: 1, reservationLeadMinutes: 0, cancellationLeadMinutes: 0, paymentMethod: "cash", employeeIds: ["staff"], addons: [], customFields: [], schedule: { monday: [{ id: "range", start: "09:00", end: "12:00" }] } });
function setup(kind, maximum, create = false, tier = "pro") {
  const states = [];
  let cursor = 0;
  let tree;
  const saved = [], toggles = [], archived = [];
  const components = new Proxy({}, { get: (_, key) => String(key) });
  const props = {
    messages: messages.es, businessId: "business", subscriptionTier: tier, businessSlug: "example", referenceDate: "2099-01-01",
    employees: kind === "employees" ? [...Array.from({ length: maximum }, (_, index) => entity(String(index))), entity("hidden", false)] : [entity("staff")],
    services: kind === "services" ? [...Array.from({ length: maximum }, (_, index) => entity(String(index))), entity("hidden", false)] : [],
    appointments: [], startsInCreateMode: create, isMercadoPagoConfigured: true, isTransferConfigured: true,
    onSaveEmployee: async (value) => { saved.push(value); return true; },
    onSaveService: async (value) => { saved.push(value); props.services = props.services.map((row) => row.id === value.id ? value : row); return true; },
    onUpdateEmployeeVisibility: async (id, isVisible) => { toggles.push({ id, isVisible }); props.employees = props.employees.map((row) => row.id === id ? { ...row, isVisible } : row); return true; },
    onArchiveEmployee: async (id) => { archived.push(id); return true; },
    onArchiveService: async (id) => { archived.push(id); return true; },
    onValidationWarning: () => {}, onImageUploadError: () => {}, onShareError: () => {}
  };
  const mocks = {
    react: { ...require("react"), useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial; return [states[index], (update) => { states[index] = typeof update === "function" ? update(states[index]) : update; }]; }, useEffect: () => {}, useLayoutEffect: () => {}, useCallback: (callback) => callback, useRef: () => ({ current: null }) },
    "next/navigation": { useSearchParams: () => new URLSearchParams() },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
    "@/components/composed/useDualActionVisibility": { useDualActionVisibility: () => ({ topRef: {}, bottomRef: {}, showTopActions: true, showBottomActions: true }) },
    "@/features/scheduling/plan-limits": planLimits,
    "@/features/scheduling/service-numeric-limits": numericLimits,
    "@/features/scheduling/utils/format": format,
    "@/features/scheduling/service-cancellation-policy": cancellation,
    "@/features/scheduling/service-custom-fields": fields,
    "@/features/scheduling/service-description": { isValidServiceDescription: () => true, serviceDescriptionMaxLength: 333 },
    "@/features/scheduling/components/AvailabilityEditor": { ...components, dayKeys: ["monday"], getScheduleValidationMessage: () => null },
    "@/features/scheduling/components/PersonnelView/personnelViewUtils": { getDayKeyForDate: () => "monday", formatTodayRanges: () => "9–12", getWeeklyOccupation: () => 0, getInitials: () => "N", getPersonnelStepValidationMessage: () => null },
    "@/lib/networking/endpoints/scheduling": { createNewEmployeeDraft: () => entity("new"), createNewServiceDraft: () => entity("new") }
  };
  const path = kind === "employees" ? "./PersonnelView/index.tsx" : "./ServicesView.tsx";
  const url = new URL(path, import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => mocks[name] ?? (name.startsWith("@/") ? components : require(name));
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  const nodes = (node = tree) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children, node.props?.actions].flat(Infinity).filter(Boolean).flatMap((child) => nodes(child))];
  const render = () => { cursor = 0; tree = (kind === "employees" ? loaded.exports.PersonnelView : loaded.exports.ServicesView)(props); };
  const visibilitySwitch = (id) => kind === "employees"
    ? nodes().find((node) => node.type === "EmployeeVisibilitySwitch" && node.props.employee.id === id)
    : nodes(nodes().find((node) => node.type === "tr" && node.key === id)).find((node) => node.type?.name === "VisibilitySwitch");
  return { render, nodes, props, saved, toggles, archived, visibilitySwitch, modal: () => nodes().find((node) => node.type === "PlanLimitModal") };
}

for (const [tier, kind, maximum] of [["pro", "employees", 3], ["pro", "services", 10], ["free", "employees", 1], ["free", "services", 2]]) {
  test(`${tier} ${kind} creation at capacity completes with hidden visibility`, async () => {
    const app = setup(kind, maximum, true, tier);
    app.render();
    const submit = app.nodes().find((node) => typeof node.props?.onSubmit === "function");
    assert.ok(submit, "creation stays available at capacity");
    assert.equal(app.saved.length, 0);
    await submit.props.onSubmit();
    assert.equal(app.saved.length, 1);
    assert.equal(app.saved[0].isVisible, false);
  });

  test(`${tier} ${kind} activation opens a popup without sending a request and works after hiding another`, async () => {
    const app = setup(kind, maximum, false, tier);
    app.render();
    assert.ok(app.visibilitySwitch("hidden"));
    await app.visibilitySwitch("hidden").props.onToggle();
    app.render();
    assert.equal(app.modal().props.isOpen, true);
    assert.ok(app.modal().props.description.includes(tier.toUpperCase()));
    assert.equal(app.modal().props.badge, "Plan INFINITY");
    assert.equal(app.modal().props.actionLabel, "Ver INFINITY");
    assert.ok(app.modal().props.description.includes(String(maximum)));
    assert.equal(app.saved.length + app.toggles.length, 0);
    app.modal().props.onClose();
    await app.visibilitySwitch("0").props.onToggle();
    app.render();
    await app.visibilitySwitch("hidden").props.onToggle();
    app.render();
    assert.equal(app.modal().props.isOpen, false);
    assert.equal(app.props[kind].filter((row) => row.isVisible).length, maximum);
    assert.equal(app.props[kind].find((row) => row.id === "hidden").isVisible, true);
  });
}


for (const [tier, kind, count, excessId] of [["free", "employees", 4, "3"], ["free", "services", 4, "3"], ["pro", "employees", 5, "4"], ["pro", "services", 12, "9"]]) {
  test(`legacy ${tier} ${kind} above quota are blurred with a full overlay and can still be hidden`, async () => {
    const app = setup(kind, count, false, tier);
    app.render();
    const indicator = app.nodes().find((node) => node.type === "PlanLimitIndicator");
    assert.ok(indicator);
    assert.equal(indicator.props.label, messages.es.planLimits.lockedCardHint);
    indicator.props.onClick();
    app.render();
    assert.equal(app.modal().props.isOpen, true);
    app.modal().props.onClose();
    app.render();
    if (kind === "services") {
      const row = app.nodes().find((node) => node.type === "tr" && node.key === excessId);
      const cells = [row.props.children].flat(Infinity).filter((node) => node?.type === "td");
      assert.equal(cells.length, 8);
      assert.equal(cells.filter((cell) => cell.props.inert && cell.props["aria-hidden"]).length, 5);
      const overlay = app.nodes(row).find((node) => node.props?.["data-plan-overlay"] === true);
      assert.ok(app.nodes(cells[6]).some((node) => node.type?.name === "VisibilitySwitch"));
      const menu = app.nodes(cells[7]).find((node) => node.type?.name === "ServiceActionsMenu");
      assert.equal(menu.props.archiveOnly, true);
      assert.notEqual(cells[6].props.inert, true);
      assert.notEqual(cells[7].props.inert, true);
      assert.match(overlay.props.className, /absolute inset-0/);
      assert.match(row.props.className, /blur-\[2px\]/);
    } else {
      const card = app.nodes().find((node) => node.type === "Card" && node.key === excessId);
      assert.ok(app.nodes(card).some((node) => node.props?.inert && /blur-\[2px\]/.test(node.props.className)));
      assert.ok(app.nodes(card).some((node) => node.props?.className?.includes("absolute inset-0")));
      const controls = app.nodes(card).find((node) => node.props?.className?.includes("absolute right-5 top-5"));
      assert.ok(controls, "employee controls retain the header position above the blur");
      assert.ok(app.nodes(card).some((node) => node.props?.className === "h-16 w-24 shrink-0" && node.props["aria-hidden"] === "true"), "blocked header reserves the same height as the normal controls");
      assert.ok(app.nodes(controls).some((node) => node.type === "EmployeeVisibilitySwitch"));
      assert.ok(app.nodes(controls).some((node) => node.type === "EmployeeActionsMenu"));
    }
    const remove = app.nodes().find((node) => node.type === "Button" && node.props["aria-label"] === messages.es.actions.archive);
    assert.equal(remove, undefined, "archive is exposed through the three-dot menu rather than a standalone trash button");
    const toggle = app.visibilitySwitch(excessId);
    assert.ok(toggle, "excess records still expose their visibility switch");
    assert.notEqual(toggle.props.isDisabled, true);
    await toggle.props.onToggle();
    app.render();
    assert.equal(app.props[kind].find((row) => row.id === excessId).isVisible, false);
    assert.equal(app.modal().props.isOpen, false);
    const switches = app.nodes().filter((node) => node.type === "EmployeeVisibilitySwitch");
    assert.ok(switches.every((node) => node.props.isDisabled !== true));
  });
}


test("plan limit indicator uses brand-strong text and border without an icon and opens the modal", () => {
  const url = new URL("./PlanLimitIndicator.tsx", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => name === "@/components/ui/Button" ? { Button: "Button" } : require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, url.pathname);
  let opens = 0;
  const tree = loaded.exports.PlanLimitIndicator({ label: "Fuera del cupo", onClick: () => { opens++; } });
  assert.equal(tree.props.children, "Fuera del cupo");
  assert.equal(messages.es.planLimits.lockedCardHint, "Fuera del cupo");
  assert.equal(messages.en.planLimits.lockedCardHint, "Outside plan limit");
  assert.equal(tree.props.icon, undefined);
  assert.match(tree.props.className, /!border-brand-strong/);
  assert.match(tree.props.className, /!text-brand-strong/);
  tree.props.onClick();
  assert.equal(opens, 1);
});
