import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { messages } from "../../i18n/messages.ts";

const require = createRequire(import.meta.url);
function harness() {
  let isOpen = false, effect, tree, refIndex = 0;
  const calls = [];
  const refs = [
    { current: { contains: (target) => Boolean(target?.inside), querySelector: () => ({ focus: () => calls.push("trigger-focus") }) } },
    { current: { querySelector: () => ({ focus: () => calls.push("option-focus") }) } }
  ];
  const modules = {
    react: {
      useState: () => [isOpen, (next) => { isOpen = typeof next === "function" ? next(isOpen) : next; }],
      useEffect: (callback) => { effect = callback; }, useRef: () => refs[refIndex++], useId: () => "exceptions"
    },
    "@/components/ui/Button": { Button: "button" },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
  };
  const url = new URL("./CalendarExceptionsMenu.tsx", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  const render = () => { refIndex = 0; tree = loaded.exports.CalendarExceptionsMenu({ messages: messages.es, onBlockedDays: () => calls.push("blocked"), onSpecialHours: () => calls.push("special") }); };
  const trigger = () => tree.props.children[0];
  const options = () => tree.props.children[1]?.props.children ?? [];
  render();
  return { render, trigger, options, calls, runEffect: () => effect(), root: () => tree };
}

test("one exceptions button reveals only the two actions and closes after selecting either", () => {
  for (const index of [0, 1]) {
    const app = harness();
    assert.equal(app.options().length, 0);
    assert.equal(app.trigger().props["aria-expanded"], false);
    app.trigger().props.onClick();
    app.render();
    assert.equal(app.trigger().props["aria-expanded"], true);
    assert.deepEqual(app.options().map((node) => node.props.children), ["Días bloqueados", "Horarios especiales"]);
    app.options()[index].props.onClick();
    app.render();
    assert.equal(app.options().length, 0);
    assert.ok(app.calls.includes(index === 0 ? "blocked" : "special"));
    assert.ok(app.calls.includes("trigger-focus"));
  }
});

test("exceptions supports keyboard opening, Escape, outside clicks and focus leaving the dropdown", () => {
  const listeners = new Map();
  const oldDocument = globalThis.document, oldNode = globalThis.Node;
  class TestNode { constructor(inside = false) { this.inside = inside; } }
  globalThis.Node = TestNode;
  globalThis.document = { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name) => listeners.delete(name) };
  try {
    const app = harness();
    let prevented = false;
    app.trigger().props.onKeyDown({ key: "ArrowDown", preventDefault: () => { prevented = true; } });
    app.render();
    const cleanup = app.runEffect();
    assert.equal(prevented, true);
    assert.ok(app.calls.includes("option-focus"));
    listeners.get("keydown")({ key: "Escape", preventDefault: () => {} });
    app.render();
    assert.equal(app.trigger().props["aria-expanded"], false);
    cleanup();
    assert.equal(listeners.size, 0);
    app.trigger().props.onClick(); app.render();
    const cleanPointer = app.runEffect();
    listeners.get("pointerdown")({ target: new TestNode(false) });
    app.render();
    assert.equal(app.options().length, 0);
    cleanPointer();
    app.trigger().props.onClick(); app.render();
    app.root().props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: null });
    app.render();
    assert.equal(app.options().length, 0);
  } finally {
    globalThis.document = oldDocument;
    globalThis.Node = oldNode;
  }
});
