import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { messages } from "../i18n/messages.ts";

const require = createRequire(import.meta.url);
const flush = () => new Promise((resolve) => setImmediate(resolve));
function harness(relativePath, componentName, initialProps) {
  const states = [], refs = [], effects = [], motionCalls = [], calls = [];
  const listeners = new Map(), windowListeners = new Map(), frames = new Map();
  const oldWindow = globalThis.window, oldDocument = globalThis.document, oldNode = globalThis.Node;
  class TestNode { contains(node) { return Boolean(node?.inside); } }
  globalThis.Node = TestNode;
  globalThis.window = { innerWidth: 1200, innerHeight: 900, requestAnimationFrame: (callback) => { frames.set(1, callback); return 1; }, cancelAnimationFrame: (id) => frames.delete(id), addEventListener: (name, callback) => windowListeners.set(name, callback), removeEventListener: (name) => windowListeners.delete(name) };
  globalThis.document = { body: {}, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name) => listeners.delete(name) };
  let cursor = 0, dirty = false, retained = false, tree;
  const modules = {
    react: {
      useState: (initial) => { const i = cursor++; if (!(i in states)) states[i] = typeof initial === "function" ? initial() : initial; return [states[i], (update) => { const next = typeof update === "function" ? update(states[i]) : update; if (!Object.is(next, states[i])) { states[i] = next; dirty = true; } }]; },
      useRef: (initial) => refs[cursor++] ??= { current: initial },
      useId: () => "actions",
      useEffect: (callback) => effects.push(callback), useLayoutEffect: (callback) => effects.push(callback),
      useCallback: (callback) => callback
    },
    "react-dom": { createPortal: (content) => content },
    "@/components/ui/TextField": { TextField: "TextField" },
    "@/features/scheduling/components/LoadingDotsText": { LoadingDotsText: "LoadingDotsText" },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
    "@/components/ui/useDropdownMotion": { useDropdownMotion: (options) => { motionCalls.push(options); return { isPresent: options.isOpen || retained }; } }
  };
  const url = new URL(relativePath, import.meta.url), loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? (name.startsWith("@/") ? {} : require(name));
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText + `\nexports.TestComponent = ${componentName};`, url.pathname);
  const props = { messages: messages.es, ...initialProps };
  const nodes = (node = tree) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).filter(Boolean).flatMap((child) => nodes(child))];
  function render() {
    let renders = 0;
    do {
      if (++renders > 10) throw new Error("Render loop");
      cursor = 0; dirty = false; effects.length = 0;
      tree = loaded.exports.TestComponent(props);
    } while (dirty);
    for (const node of nodes()) if (node.props?.ref) {
      node.props.ref.current = Object.assign(new TestNode(), {
        offsetWidth: 160, offsetHeight: 176,
        getBoundingClientRect: () => ({ left: 100, right: 132, top: 100, bottom: 132, width: 32, height: 32 }),
        closest: () => ({ classList: ["theme-coral"] }), focus: () => calls.push("focus")
      });
    }
    return tree;
  }
  const button = (text) => nodes().find((node) => node.type === "button" && [node.props.children].flat(Infinity).includes(text));
  const trigger = () => nodes().find((node) => node.type === "button" && node.props["aria-label"] === messages.es.actions.openMenu);
  render();
  return { props, render, nodes, button, trigger, motionCalls, calls, effects, listeners, windowListeners, flushFrame: () => { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } }, retain: (value) => { retained = value; },
    restore() { globalThis.window = oldWindow; globalThis.document = oldDocument; globalThis.Node = oldNode; }
  };
}

function actionProps(target) {
  return { [target]: { id: target, isArchived: false, isVisible: true }, disabled: false, loadingAction: null, onShare() {}, onEdit() {}, onDuplicate() {}, onArchive: async () => {}, onUnarchive: async () => {}, onDelete: async () => {} };
}

for (const [target, path, component] of [["employee", "./PersonnelView/EmployeeControls.tsx", "EmployeeActionsMenu"], ["service", "./ServicesView.tsx", "ServiceActionsMenu"]]) {
  test(`${target} action menus use diagonal motion and keep async actions and loading guards through the exit`, async () => {
    const app = harness(path, component, actionProps(target));
    try {
      assert.equal(app.motionCalls.at(-1).variant, "diagonal");
      assert.equal(app.trigger().props["aria-expanded"], false);
      let finish, saved = 0;
      app.props.onArchive = () => { saved++; return new Promise((resolve) => { finish = resolve; }); };
      app.trigger().props.onClick(); app.render();
      assert.equal(app.trigger().props["aria-expanded"], true);
      app.button(messages.es.actions.archive).props.onClick();
      assert.equal(saved, 1);
      app.props.loadingAction = "archive"; app.render();
      assert.equal(app.button(messages.es.actions.archive).props.disabled, true);
      app.button(messages.es.actions.archive).props.onClick();
      assert.equal(saved, 1);
      app.retain(true); finish(); await flush(); app.render();
      assert.equal(app.motionCalls.at(-1).isOpen, false);
      assert.ok(app.nodes().some((node) => node.props?.inert === true));
      app.retain(false); app.render();
      assert.equal(app.button(messages.es.actions.archive), undefined);
    } finally { app.restore(); }
  });

  test(`${target} archived menus keep restore and delete actions and omit archive`, async () => {
    let restored = 0, deleted = 0;
    const app = harness(path, component, { ...actionProps(target), [target]: { id: target, isArchived: true }, onUnarchive: async () => { restored++; }, onDelete: async () => { deleted++; } });
    try {
      app.trigger().props.onClick(); app.render();
      assert.equal(app.button(messages.es.actions.archive), undefined);
      app.button(messages.es.actions.unarchive).props.onClick(); await flush(); app.render();
      assert.equal(restored, 1);
      app.trigger().props.onClick(); app.render();
      app.button(messages.es.actions.delete).props.onClick(); await flush(); app.render();
      assert.equal(deleted, 1);
    } finally { app.restore(); }
  });
}

test("service share, edit and duplicate actions keep their callbacks and close with retained motion", () => {
  for (const [label, callback] of [[messages.es.actions.share, "onShare"], [messages.es.actions.edit, "onEdit"], [messages.es.actions.duplicate, "onDuplicate"]]) {
    let called = 0;
    const app = harness("./ServicesView.tsx", "ServiceActionsMenu", { ...actionProps("service"), [callback]: () => { called++; } });
    try {
      app.trigger().props.onClick(); app.render(); app.retain(true);
      app.button(label).props.onClick(); app.render();
      assert.equal(called, 1); assert.equal(app.motionCalls.at(-1).isOpen, false);
      assert.ok(app.nodes().some((node) => node.props?.inert));
    } finally { app.restore(); }
  }
});

test("the controlled personnel menu uses a button and supports Escape and outside dismissal", () => {
  const app = harness("./PersonnelView/EmployeeControls.tsx", "EmployeeActionsMenu", actionProps("employee"));
  const cleanups = [];
  try {
    assert.equal(app.trigger().type, "button");
    app.trigger().props.onClick(); app.render();
    cleanups.push(...app.effects.map((effect) => effect()));
    app.listeners.get("keydown")({ key: "Escape", preventDefault() {} }); app.render();
    assert.equal(app.trigger().props["aria-expanded"], false); assert.ok(app.calls.includes("focus"));
    cleanups.forEach((cleanup) => cleanup?.()); cleanups.length = 0;
    app.trigger().props.onClick(); app.render();
    cleanups.push(...app.effects.map((effect) => effect()));
    app.listeners.get("pointerdown")({ target: new globalThis.Node() }); app.render();
    assert.equal(app.trigger().props["aria-expanded"], false);
  } finally { cleanups.forEach((cleanup) => cleanup?.()); app.restore(); }
});

test("shared customer suggestions preserve focus, callbacks, loading and visible content through closing", () => {
  const suggestion = { id: "customer", fullName: "Sample", email: "sample@example.com", phone: "123" };
  const selected = [], input = [];
  const app = harness("../../booking-flow/components/CustomerLookupField.tsx", "CustomerLookupField", { isOpen: true, isLoading: false, label: "Customer", value: "Sam", suggestions: [suggestion], onBlur() {}, onFocus() {}, onChange: (value) => input.push(value), onSelect: (value) => selected.push(value) });
  try {
    assert.equal(app.motionCalls.at(-1).variant, "vertical");
    app.nodes().find((node) => node.type === "TextField").props.onChange({ target: { value: "Sample" } });
    assert.deepEqual(input, ["Sample"]);
    const option = () => app.nodes().find((node) => node.type === "button");
    let prevented = false;
    option().props.onMouseDown({ preventDefault: () => { prevented = true; } });
    option().props.onClick(); assert.equal(prevented, true); assert.deepEqual(selected, [suggestion]);
    app.retain(true); app.props.isOpen = false; app.props.suggestions = []; app.render();
    assert.ok(option()); assert.ok(app.nodes().some((node) => node.props?.inert));
    option().props.onClick(); assert.equal(selected.length, 1);
    app.retain(false); app.render(); assert.equal(option(), undefined);
    app.props.isOpen = true; app.props.isLoading = true; app.render();
    assert.ok(app.nodes().some((node) => node.type === "LoadingDotsText" && node.props.text === messages.es.bookingFlow.customerLookupLoading));
  } finally { app.restore(); }
});

test("floating help uses diagonal motion and retains its themed panel through blur and Escape", () => {
  const app = harness("../../../components/ui/FloatingInfoPopover.tsx", "FloatingInfoPopover", { ariaLabel: "Information", children: "i", content: "Help text" });
  try {
    const trigger = () => app.nodes().find((node) => node.type === "button");
    trigger().props.onFocus(); app.render();
    app.effects[0](); app.render();
    assert.equal(app.motionCalls.at(-1).variant, "diagonal");
    assert.equal(app.motionCalls.at(-1).ready, true);
    app.retain(true); trigger().props.onBlur(); app.render();
    const tooltip = app.nodes().find((node) => node.props?.role === "tooltip");
    assert.equal(tooltip.props.children, "Help text"); assert.equal(tooltip.props["aria-hidden"], true);
    assert.match(tooltip.props.className, /theme-coral/);
    trigger().props.onMouseEnter(); app.render(); trigger().props.onKeyDown({ key: "Escape" }); app.render();
    assert.equal(app.motionCalls.at(-1).isOpen, false);
  } finally { app.restore(); }
});


test("service action menus wait for measured placement before animating and reposition on viewport changes", () => {
  const app = harness("./ServicesView.tsx", "ServiceActionsMenu", actionProps("service"));
  let cleanup;
  try {
    app.trigger().props.onClick(); app.render();
    const panel = () => app.nodes().find((node) => node.props?.className?.includes("fixed z-50"));
    assert.equal(app.motionCalls.at(-1).ready, false);
    assert.match(panel().props.className, /invisible/);
    cleanup = app.effects[0]();
    app.flushFrame(); app.render();
    assert.equal(app.motionCalls.at(-1).ready, true);
    assert.doesNotMatch(panel().props.className, /invisible/);
    assert.deepEqual(panel().props.style, { left: 16, top: 140 });
    window.innerHeight = 150;
    app.windowListeners.get("resize")(); app.render();
    assert.equal(panel().props.style.top, 16);
  } finally { cleanup?.(); app.restore(); }
});


test("blocked service menu exposes only Archive through its existing three-dot trigger", () => {
  const app = harness("./ServicesView.tsx", "ServiceActionsMenu", { ...actionProps("service"), archiveOnly: true });
  try {
    app.trigger().props.onClick();
    app.render();
    assert.ok(app.button(messages.es.actions.archive));
    for (const label of [messages.es.actions.share, messages.es.actions.edit, messages.es.actions.duplicate, messages.es.actions.delete, messages.es.actions.unarchive]) {
      assert.equal(app.button(label), undefined);
    }
  } finally { app.restore(); }
});
