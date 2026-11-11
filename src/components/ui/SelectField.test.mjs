import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as placement from "./select-menu-position.ts";

const require = createRequire(import.meta.url);
const defaults = [
  { value: "", label: "Select one", disabled: true },
  { value: "a", label: "Árbol" },
  { value: "blocked", label: "Blocked", disabled: true },
  { value: "b", label: "Banana" },
  { value: "c", label: "Café" }
];
function setup(overrides = {}, settings = {}) {
  const old = Object.fromEntries(["window", "document", "Node", "HTMLSelectElement", "ResizeObserver", "MutationObserver"].map((name) => [name, globalThis[name]]));
  const states = [], refs = [], effects = new Map(), pending = new Map(), changes = [], calls = [], observers = [], portals = [];
  const listeners = new Map(), windowListeners = new Map(), formListeners = new Map();
  let cursor = 0, dirty = false, tree, clock = 0, nextTimer = 0;
  const timers = new Map(), allAnimations = [], frames = new Map();
  const rect = { left: 100, top: 100, bottom: 144, width: 200 };
  const form = { addEventListener: (name, callback) => formListeners.set(name, callback), removeEventListener: (name) => formListeners.delete(name) };
  class TestNode {
    contains(other) { return this === other; }
  }
  const overlay = new TestNode(), fieldset = new TestNode();
  const triggerNode = Object.assign(new TestNode(), {
    getBoundingClientRect: () => rect,
    matches: () => Boolean(props.disabled || settings.fieldsetDisabled),
    contains: (target) => target === triggerNode,
    focus: () => calls.push("focus"),
    closest: (selector) => selector === "[inert]" ? settings.inert ? overlay : null
      : selector === "fieldset" ? fieldset : selector === '[role="dialog"]' ? { parentElement: overlay }
      : { classList: [settings.theme ?? "theme-coral"] }
  });
  const menuNode = Object.assign(new TestNode(), {
    style: { opacity: "" },
    offsetWidth: 200, scrollHeight: settings.menuHeight ?? 188,
    getBoundingClientRect() {
      if (settings.currentMenuRect) return settings.currentMenuRect;
      const style = menu()?.props.style ?? {};
      const height = Math.min(this.scrollHeight, style.maxHeight ?? 256);
      return { top: style.top ?? 0, bottom: (style.top ?? 0) + height, height, left: style.left ?? 0, right: (style.left ?? 0) + (style.width ?? 200), width: style.width ?? 200 };
    },
    animate(frames, timing) {
      let complete;
      const animation = { frames, timing, cancelled: false, finished: new Promise((resolve) => { complete = resolve; }), cancel() { this.cancelled = true; }, complete: () => complete() };
      allAnimations.push(animation);
      return animation;
    },
    querySelector: (selector) => ({ scrollIntoView: (options) => calls.push(["scroll-option", selector, options]) })
  });
  class NativeSelect extends TestNode {
    constructor() { super(); this._value = ""; this.form = form; }
    get value() { return this._value; }
    set value(value) { this._value = value; }
    get validity() { return { valid: !props.required || this._value !== "" }; }
    matches() { return Boolean(props.disabled || settings.fieldsetDisabled); }
    dispatchEvent(event) { calls.push(["native-event", event.type]); native().props.onChange({ target: this, currentTarget: this, type: event.type }); return true; }
  }
  const nativeNode = new NativeSelect();
  globalThis.Node = TestNode;
  globalThis.HTMLSelectElement = NativeSelect;
  globalThis.document = { body: {}, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name) => listeners.delete(name) };
  globalThis.window = { innerWidth: 1000, innerHeight: 800,
    matchMedia: () => ({ matches: Boolean(settings.reducedMotion) }),
    setTimeout: (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: clock + delay, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: (callback) => { const id = ++nextTimer; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    addEventListener: (name, callback) => windowListeners.set(name, callback), removeEventListener: (name) => windowListeners.delete(name) };
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; observers.push(this); }
    observe(target) { this.targets.push(target); }
    disconnect() { this.disconnected = true; }
  }
  globalThis.ResizeObserver = Observer;
  globalThis.MutationObserver = Observer;
  const modules = {
    react: {
      useId: () => "generated",
      useRef: (initial) => { const index = cursor++; return refs[index] ??= { current: initial }; },
      useState: (initial) => {
        const index = cursor++;
        if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
        return [states[index], (next) => { const value = typeof next === "function" ? next(states[index]) : next; if (!Object.is(states[index], value)) { states[index] = value; dirty = true; } }];
      },
      useLayoutEffect: (callback, deps) => pending.set(cursor++, { callback, deps }),
      useEffect: (callback, deps) => pending.set(cursor++, { callback, deps })
    },
    "react-dom": { createPortal: (node, target) => { portals.push(target); return node; } },
    "@/components/ui/select-menu-position": placement,
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
  };
  const motionUrl = new URL("./useDropdownMotion.ts", import.meta.url), motionModule = new Module(motionUrl.pathname);
  motionModule.require = (name) => modules[name] ?? require(name);
  motionModule._compile(ts.transpileModule(readFileSync(motionUrl, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, motionUrl.pathname);
  modules["@/components/ui/useDropdownMotion"] = motionModule.exports;
  const url = new URL("./SelectField.tsx", import.meta.url), loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  const props = { label: "Status", name: "status", value: "", options: defaults, onChange: (event) => { changes.push({ value: event.target.value, target: event.target, type: event.type }); if (props.value !== undefined) props.value = event.target.value; }, ...overrides };
  const nodes = (node = tree) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).filter(Boolean).flatMap((child) => nodes(child))];
  const trigger = () => nodes().find((node) => node.props?.role === "combobox");
  const native = () => nodes().find((node) => node.type === "select");
  const menu = () => nodes().find((node) => node.props?.role === "listbox");
  const options = () => nodes().filter((node) => node.props?.role === "option");
  function render() {
    let renders = 0;
    do {
      if (++renders > 15) throw new Error("Render loop");
      dirty = false; cursor = 0; pending.clear();
      tree = loaded.exports.SelectField(props);
      trigger().props.ref.current = triggerNode;
      native().props.ref.current = nativeNode;
      if (props.value !== undefined) nativeNode._value = String(props.value);
      else if (renders === 1 && nativeNode._value === "") nativeNode._value = String(props.defaultValue ?? props.options.find((option) => !option.disabled)?.value ?? "");
      const list = menu();
      const menuRef = refs[2];
      if (menuRef) menuRef.current = list ? menuNode : null;
      if (dirty) continue;
      for (const [index, effect] of pending) {
        const previous = effects.get(index);
        if (previous && effect.deps.every((value, i) => Object.is(value, previous.deps[i]))) continue;
        previous?.cleanup?.();
        effects.set(index, { deps: effect.deps, cleanup: effect.callback() });
      }
    } while (dirty);
    for (const [id, callback] of [...frames]) { frames.delete(id); callback(); }
    return tree;
  }
  const open = () => { trigger().props.onClick(); render(); };
  function key(key, extra = {}) {
    const event = { key, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...extra };
    trigger().props.onKeyDown(event); render(); return event;
  }
  function advance(milliseconds) {
    clock += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.callback(); }
    render();
  }
  render();
  return { props, settings, render, advance, timers, allAnimations, get animations() { return allAnimations.filter((animation) => animation.timing.easing === "ease-in"); }, trigger, native, menu, options, open, key, changes, calls, portals, listeners, windowListeners, formListeners, rect, observers, nativeNode, triggerNode, menuNode,
    restore() { for (const effect of effects.values()) effect.cleanup?.(); for (const [name, value] of Object.entries(old)) globalThis[name] = value; }
  };
}

test("the visible control opens an application listbox while the hidden native select preserves form semantics", () => {
  const app = setup({ required: true });
  try {
    assert.equal(app.trigger().props.id, "status");
    assert.equal(app.trigger().props["aria-required"], true);
    assert.equal(app.native().props.name, "status");
    assert.equal(app.native().props.required, true);
    assert.equal(app.native().props.tabIndex, -1);
    assert.equal(app.native().props["aria-hidden"], "true");
    app.advance(150); assert.equal(app.menu(), undefined);
    app.open();
    assert.equal(app.trigger().props["aria-expanded"], true);
    assert.equal(app.trigger().props["aria-controls"], app.menu().props.id);
    assert.equal(app.options().length, defaults.length);
    assert.equal(app.options()[0].props.disabled, true);
    assert.ok(app.portals.every((target) => target === document.body));
    assert.match(app.menu().props.className, /theme-coral/);
    assert.equal(app.allAnimations.at(-1).timing.easing, "ease-out");
    assert.equal(app.allAnimations.at(-1).frames[0].clipPath, "inset(0px 0px 188px 0px)");
    assert.match(app.menu().props.className, /motion-reduce:animate-none/);
  } finally { app.restore(); }
});

test("choosing an enabled option dispatches the native change contract once and returns focus", () => {
  const app = setup({ value: "a" });
  try {
    app.open(); app.options()[3].props.onClick(); app.render();
    assert.deepEqual(app.changes.map(({ value, type }) => ({ value, type })), [{ value: "b", type: "change" }]);
    assert.equal(app.changes[0].target, app.nativeNode);
    assert.ok(app.calls.some((call) => Array.isArray(call) && call[0] === "native-event"));
    assert.ok(app.calls.includes("focus"));
    assert.equal(app.trigger().props["aria-expanded"], false);
    app.advance(150); assert.equal(app.menu(), undefined);
    app.open(); app.options()[3].props.onClick(); app.render();
    assert.equal(app.changes.length, 1);
    app.open(); app.options()[2].props.onClick(); app.render();
    assert.equal(app.changes.length, 1);
    assert.equal(app.trigger().props["aria-expanded"], true);
  } finally { app.restore(); }
});

test("keyboard navigation skips disabled options, wraps, supports Home/End and commits with Enter or Space", () => {
  const app = setup({ value: "a" });
  try {
    app.key("ArrowDown");
    assert.equal(app.trigger().props["aria-activedescendant"], "status-options-1");
    app.key("ArrowDown");
    assert.equal(app.trigger().props["aria-activedescendant"], "status-options-3");
    assert.equal(app.changes.length, 0);
    app.key("End"); assert.equal(app.trigger().props["aria-activedescendant"], "status-options-4");
    app.key("ArrowDown"); assert.equal(app.trigger().props["aria-activedescendant"], "status-options-1");
    app.key("ArrowUp"); assert.equal(app.trigger().props["aria-activedescendant"], "status-options-4");
    app.key("Enter"); assert.equal(app.changes.at(-1).value, "c");
    app.key("Home"); app.key(" "); assert.equal(app.changes.at(-1).value, "a");
    app.advance(150); assert.equal(app.menu(), undefined);
  } finally { app.restore(); }
});

test("Escape closes only the dropdown, Tab continues navigation, blur and outside clicks dismiss it", () => {
  const app = setup({ value: "a" });
  try {
    app.open();
    app.listeners.get("pointerdown")({ target: app.menuNode }); app.render();
    assert.ok(app.menu());
    const escape = app.key("Escape");
    assert.equal(escape.prevented, true); assert.equal(escape.stopped, true);
    app.advance(150); assert.equal(app.menu(), undefined); assert.equal(app.changes.length, 0);
    app.open(); assert.equal(app.key("Tab").prevented, false); app.advance(150); assert.equal(app.menu(), undefined);
    app.open(); app.trigger().props.onBlur(); app.render(); app.advance(150); assert.equal(app.menu(), undefined);
    app.open(); app.listeners.get("pointerdown")({ target: new globalThis.Node() }); app.render();
    app.advance(150); assert.equal(app.menu(), undefined);
    assert.equal(app.listeners.size, 0); assert.equal(app.windowListeners.size, 0);
    assert.ok(app.observers.every((observer) => observer.disconnected));
  } finally { app.restore(); }
});

test("typing finds accented labels and disabled controls never open or select", () => {
  const app = setup({ value: "b" });
  try {
    app.key("a"); app.key("r");
    assert.equal(app.trigger().props["aria-activedescendant"], "status-options-1");
    app.key("Enter"); assert.equal(app.changes.at(-1).value, "a");
    app.open(); app.props.disabled = true; app.render();
    app.advance(150); assert.equal(app.menu(), undefined);
    app.open(); app.advance(150); assert.equal(app.menu(), undefined);
    app.props.disabled = false; app.render();
    app.advance(150); assert.equal(app.menu(), undefined);
    app.settings.fieldsetDisabled = true; app.open();
    app.advance(150); assert.equal(app.menu(), undefined);
  } finally { app.restore(); }
});

for (const theme of ["theme-coral", "theme-blue", "theme-sage"]) {
  test(`the portaled menu preserves ${theme}, follows its trigger and opens above near the bottom`, () => {
    const app = setup({}, { theme, menuHeight: 600 });
    try {
      app.rect.left = 950; app.rect.top = 720; app.rect.bottom = 764;
      app.open();
      assert.match(app.menu().props.className, new RegExp(theme));
      assert.equal(app.allAnimations.at(-1).frames[0].clipPath, "inset(256px 0px 0px 0px)");
      assert.equal(app.menu().props.style.maxHeight, 256);
      assert.equal(app.menu().props.style.left, 788);
      assert.equal(app.menu().props.style.top, 460);
      app.rect.top = 40; app.rect.bottom = 84; app.rect.left = 20;
      app.windowListeners.get("scroll")(); app.render();
      assert.equal(app.menu().props.style.top, 88);
      assert.equal(app.menu().props.style.left, 20);
      assert.equal(app.menu().props.style.top > app.rect.bottom, true);
      assert.ok(app.calls.some((call) => Array.isArray(call) && call[0] === "scroll-option"));
    } finally { app.restore(); }
  });
}

test("menus close if their modal becomes inert or a containing fieldset is disabled", () => {
  for (const setting of ["inert", "fieldsetDisabled"]) {
    const app = setup();
    try {
      app.open(); app.settings[setting] = true;
      app.observers.at(-1).callback(); app.render();
      app.advance(150); assert.equal(app.menu(), undefined);
    } finally { app.restore(); }
  }
});

test("native required validation focuses and marks the custom trigger, then clears after a valid selection", () => {
  let invalidCalled = false;
  const app = setup({ required: true, onInvalid: () => { invalidCalled = true; } });
  try {
    let prevented = false;
    app.native().props.onInvalid({ preventDefault: () => { prevented = true; } }); app.render();
    assert.equal(invalidCalled, true); assert.equal(prevented, true);
    assert.equal(app.trigger().props["aria-invalid"], true); assert.ok(app.calls.includes("focus"));
    app.open(); app.options()[1].props.onClick(); app.render();
    assert.equal(app.trigger().props["aria-invalid"], undefined);
  } finally { app.restore(); }
});

test("uncontrolled fields display their default and selected values and follow native form reset", async () => {
  const app = setup({ value: undefined, defaultValue: "a" });
  try {
    app.open(); app.options()[3].props.onClick(); app.render();
    assert.equal(app.changes.at(-1).value, "b");
    assert.equal(app.trigger().props.children[0].props.children, "Banana");
    app.nativeNode.value = "a";
    app.formListeners.get("reset")();
    await new Promise((resolve) => setTimeout(resolve, 5)); app.render();
    assert.equal(app.trigger().props.children[0].props.children, "Árbol");
  } finally { app.restore(); }
});

test("positioning keeps long lists within the available viewport on either side", () => {
  assert.deepEqual(placement.getSelectMenuPosition({ left: 290, top: 80, bottom: 120, width: 200 }, 320, 240, 600), { left: 108, top: 124, width: 200, maxHeight: 104, opensAbove: false });
  const above = placement.getSelectMenuPosition({ left: -20, top: 180, bottom: 220, width: 400 }, 320, 240, 600);
  assert.equal(above.left, 12); assert.equal(above.width, 296); assert.equal(above.maxHeight, 164); assert.equal(above.top, 12); assert.equal(above.opensAbove, true);
});


for (const opensAbove of [false, true]) {
  test(`closing a menu that opens ${opensAbove ? "above" : "below"} reverses its reveal for exactly 150 ms`, () => {
    const app = setup({ value: "a" });
    try {
      if (opensAbove) { app.rect.top = 720; app.rect.bottom = 764; }
      app.open();
      const position = { ...app.menu().props.style };
      app.key("Escape");
      assert.equal(app.trigger().props["aria-expanded"], false);
      assert.equal(app.menu().props.inert, true);
      assert.equal(app.menu().props["aria-hidden"], true);
      assert.deepEqual(app.menu().props.style, position);
      assert.deepEqual(app.animations.at(-1).frames, [
        { opacity: 1, clipPath: "inset(0px 0px 0px 0px)" },
        { opacity: 1, clipPath: opensAbove ? "inset(188px 0px 0px 0px)" : "inset(0px 0px 188px 0px)" }
      ]);
      assert.equal(app.animations.at(-1).timing.duration, 150);
      assert.deepEqual(app.options().map((option) => Boolean(option.props.disabled)), defaults.map((option) => Boolean(option.disabled)));
      app.options()[3].props.onClick(); app.render();
      assert.equal(app.changes.length, 0);
      app.advance(149); assert.ok(app.menu());
      app.advance(1); assert.equal(app.menu(), undefined);
      assert.equal(app.timers.size, 0);
    } finally { app.restore(); }
  });
}

test("reopening during the close animation cancels removal and re-enables selection", () => {
  const app = setup({ value: "a" });
  try {
    app.open(); app.key("Escape");
    app.advance(75);
    app.open();
    assert.equal(app.timers.size, 0);
    assert.equal(app.animations[0].cancelled, true);
    assert.equal(app.menu().props.inert, false);
    assert.equal(app.allAnimations.at(-1).timing.easing, "ease-out");
    app.advance(200); assert.ok(app.menu());
    app.options()[3].props.onClick(); app.render();
    assert.equal(app.changes.at(-1).value, "b");
    assert.equal(app.menu().props.inert, true);
    app.advance(150); assert.equal(app.menu(), undefined);
  } finally { app.restore(); }
});

test("reduced motion closes without animation delay and unmounting clears pending exit timers", () => {
  const app = setup({}, { reducedMotion: true });
  try {
    app.open(); app.key("Escape");
    assert.equal([...app.timers.values()][0].delay, 0);
    assert.equal(app.animations.length, 0);
    assert.match(app.menu().props.className, /motion-reduce:animate-none/);
    app.advance(0); assert.equal(app.menu(), undefined);
  } finally { app.restore(); }
  const pending = setup();
  pending.open(); pending.key("Escape");
  assert.equal(pending.timers.size, 1);
  pending.restore();
  assert.equal(pending.timers.size, 0);
  assert.equal(pending.animations[0].cancelled, true);
});


for (const opensAbove of [false, true]) {
  test(`closing after a theme selection contracts toward the field from ${opensAbove ? "above" : "below"} without fading`, () => {
    const app = setup({ value: "a" });
    try {
      if (opensAbove) { app.rect.top = 720; app.rect.bottom = 764; }
      app.open();
      app.advance(1000);
      app.options()[3].props.onClick(); app.render();
      app.props.options = app.props.options.map((option) => ({ ...option }));
      app.settings.theme = "theme-blue";
      app.render();
      assert.equal(app.animations.length, 1);
      const animation = app.animations[0];
      assert.deepEqual(animation.frames[0], { opacity: 1, clipPath: "inset(0px 0px 0px 0px)" });
      assert.deepEqual(animation.frames[1], { opacity: 1, clipPath: opensAbove ? "inset(188px 0px 0px 0px)" : "inset(0px 0px 188px 0px)" });
      assert.deepEqual(animation.timing, { duration: 150, easing: "ease-in", fill: "forwards" });
      assert.doesNotMatch(app.menu().props.className, /animate-\[/);
      app.advance(149); assert.ok(app.menu());
      app.advance(1); assert.equal(app.menu(), undefined);
    } finally { app.restore(); }
  });
}

test("animation completion removes the menu and clears its fallback timer", async () => {
  const app = setup();
  try {
    app.open(); app.key("Escape");
    const animation = app.animations.at(-1);
    assert.ok(app.menu());
    animation.complete();
    await Promise.resolve(); app.render();
    assert.equal(app.menu(), undefined);
    assert.equal(app.timers.size, 0);
    assert.equal(animation.cancelled, true);
  } finally { app.restore(); }
});


for (const initiallyAbove of [false, true]) {
  test(`resizing from ${initiallyAbove ? "above to below" : "below to above"} closes toward the field using the current position`, () => {
    const app = setup({ value: "a" });
    try {
      app.rect.top = initiallyAbove ? 720 : 100;
      app.rect.bottom = app.rect.top + 44;
      app.open();
      app.rect.top = initiallyAbove ? 100 : 720;
      app.rect.bottom = app.rect.top + 44;
      app.windowListeners.get("resize")(); app.render();
      const currentRect = app.menuNode.getBoundingClientRect();
      const currentlyAbove = currentRect.top < app.rect.top;
      assert.equal(currentlyAbove, !initiallyAbove);
      app.key("Escape");
      const frames = app.animations.at(-1).frames;
      assert.ok(frames.every((frame) => frame.opacity === 1));
      assert.equal(frames[1].clipPath, currentlyAbove
        ? `inset(${currentRect.height}px 0px 0px 0px)`
        : `inset(0px 0px ${currentRect.height}px 0px)`);
      app.advance(150); assert.equal(app.menu(), undefined);
    } finally { app.restore(); }
  });
}

test("closing reads the rendered menu geometry instead of relying on the original placement flag", () => {
  const app = setup();
  try {
    app.open();
    assert.equal(app.menu().props.style.top > app.rect.bottom, true);
    app.settings.currentMenuRect = { top: 10, bottom: 90, height: 80 };
    app.key("Escape");
    assert.deepEqual(app.animations.at(-1).frames, [
      { opacity: 1, clipPath: "inset(0px 0px 0px 0px)" },
      { opacity: 1, clipPath: "inset(80px 0px 0px 0px)" }
    ]);
  } finally { app.restore(); }
});
