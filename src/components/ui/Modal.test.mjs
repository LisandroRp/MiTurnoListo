import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import * as React from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
let active;
const url = new URL("./Modal.tsx", import.meta.url);
const loaded = new Module(url.pathname);
const modules = {
  react: { ...React,
    useState(initial) {
      const owner = active, index = owner.cursor++;
      if (!(index in owner.states)) owner.states[index] = typeof initial === "function" ? initial() : initial;
      return [owner.states[index], (next) => {
        const value = typeof next === "function" ? next(owner.states[index]) : next;
        if (!Object.is(value, owner.states[index])) { owner.states[index] = value; owner.dirty = true; }
      }];
    },
    useEffect(callback, deps) { const index = active.cursor++; active.pending.set(index, { callback, deps }); }
  },
  "@/components/ui/Card": { Card: "Card" },
  "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
};
loaded.require = (name) => modules[name] ?? require(name);
loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);

function environment(reduced = false) {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  const timers = new Map(), instances = [];
  let clock = 0, nextId = 0;
  globalThis.document = { body: { style: { overflow: "auto" } } };
  globalThis.window = {
    matchMedia: () => ({ matches: reduced }),
    setTimeout: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, at: clock + delay, delay }); return id; },
    clearTimeout: (id) => timers.delete(id)
  };
  function mount(component = loaded.exports.Modal, initialProps = { isOpen: false, children: "Content" }) {
    const owner = { states: [], effects: new Map(), pending: new Map(), cursor: 0, dirty: false };
    const props = { ...initialProps };
    let tree;
    function render() {
      let renders = 0;
      do {
        if (++renders > 10) throw new Error("Render loop");
        owner.dirty = false; owner.cursor = 0; owner.pending.clear(); active = owner;
        tree = component(props);
      } while (owner.dirty);
      for (const [index, effect] of owner.pending) {
        const previous = owner.effects.get(index);
        if (previous && effect.deps.every((value, i) => Object.is(value, previous.deps[i]))) continue;
        previous?.cleanup?.();
        owner.effects.set(index, { deps: effect.deps, cleanup: effect.callback() });
      }
      return tree;
    }
    function dispose() { for (const effect of owner.effects.values()) effect.cleanup?.(); owner.effects.clear(); }
    const instance = { props, render, dispose, tree: () => tree };
    instances.push(instance); render(); return instance;
  }
  function advance(milliseconds) {
    clock += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.callback(); }
  }
  return { mount, advance, timers, restore() { instances.forEach((instance) => instance.dispose()); globalThis.window = oldWindow; globalThis.document = oldDocument; } };
}

test("a modal fades in and retains its last content and scroll lock for the complete exit", () => {
  const env = environment();
  try {
    const app = env.mount();
    assert.equal(app.tree(), null);
    assert.equal(document.body.style.overflow, "auto");
    app.props.isOpen = true; app.render();
    assert.match(app.tree().props.className, /modal-fade-in_150ms/);
    assert.equal(app.tree().props.inert, false);
    assert.equal(document.body.style.overflow, "hidden");
    app.props.isOpen = false; app.props.children = null; app.render();
    assert.match(app.tree().props.className, /modal-fade-out_150ms/);
    assert.equal(app.tree().props.inert, true);
    assert.equal(app.tree().props["aria-hidden"], true);
    assert.equal(app.tree().props.children.props.children, "Content");
    env.advance(149); app.render();
    assert.ok(app.tree());
    assert.equal(document.body.style.overflow, "hidden");
    env.advance(1); app.render();
    assert.equal(app.tree(), null);
    assert.equal(document.body.style.overflow, "auto");
  } finally { env.restore(); }
});

test("reopening during the exit cancels stale removal and unmount cleanup releases timers and scrolling", () => {
  const env = environment();
  try {
    const app = env.mount(loaded.exports.Modal, { isOpen: true, children: "Content" });
    app.props.isOpen = false; app.render();
    env.advance(75);
    app.props.isOpen = true; app.render();
    assert.equal(env.timers.size, 0);
    env.advance(200); app.render();
    assert.ok(app.tree());
    assert.equal(app.tree().props.inert, false);
    app.props.isOpen = false; app.render();
    assert.equal(env.timers.size, 1);
    app.dispose();
    assert.equal(env.timers.size, 0);
    assert.equal(document.body.style.overflow, "auto");
  } finally { env.restore(); }
});

test("overlapping modals restore the original scroll state only after the last exit", () => {
  const env = environment();
  try {
    const first = env.mount(loaded.exports.Modal, { isOpen: true, children: "First" });
    const second = env.mount(loaded.exports.Modal, { isOpen: true, children: "Second" });
    first.props.isOpen = false; first.render();
    env.advance(150); first.render();
    assert.equal(document.body.style.overflow, "hidden");
    second.props.isOpen = false; second.render();
    env.advance(150); second.render();
    assert.equal(document.body.style.overflow, "auto");
  } finally { env.restore(); }
});

test("reduced motion disables animation and removes the modal without waiting 150 ms", () => {
  const env = environment(true);
  try {
    const app = env.mount(loaded.exports.Modal, { isOpen: true, children: "Content" });
    assert.match(app.tree().props.className, /motion-reduce:animate-none/);
    assert.equal(loaded.exports.getModalFadeDuration(), 0);
    app.props.isOpen = false; app.render();
    assert.equal([...env.timers.values()][0].delay, 0);
    env.advance(0); app.render();
    assert.equal(app.tree(), null);
    assert.equal(document.body.style.overflow, "auto");
  } finally { env.restore(); }
});

test("conditional modal children retain their props through exit and remount cleanly after closing", () => {
  const env = environment();
  try {
    const app = env.mount(loaded.exports.ModalPresence, { children: null });
    assert.equal(app.tree(), null);
    app.props.children = React.createElement("ProfessionalModal", { isOpen: true, employeeId: "first" }); app.render();
    assert.equal(app.tree().props.isOpen, true);
    app.props.children = null; app.render();
    assert.equal(app.tree().type, "ProfessionalModal");
    assert.equal(app.tree().props.isOpen, false);
    assert.equal(app.tree().props.employeeId, "first");
    env.advance(150); app.render();
    assert.equal(app.tree(), null);
    app.props.children = React.createElement("ProfessionalModal", { employeeId: "second" }); app.render();
    assert.equal(app.tree().props.isOpen, true);
    assert.equal(app.tree().props.employeeId, "second");
  } finally { env.restore(); }
});
