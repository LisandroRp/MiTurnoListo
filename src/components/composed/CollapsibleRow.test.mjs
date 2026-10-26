import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const url = new URL("./CollapsibleRow.tsx", import.meta.url);

test("rows exceeding the adjacent controls height expand, fade and adapt to resizing", () => {
  const states = [];
  let cursor = 0, refCursor = 0, effect, onResize, cleanup;
  const items = [0, 0, 0, 56, 56, 112].map((offsetTop) => ({ offsetTop, offsetHeight: 48, inert: false }));
  const content = { children: items, scrollHeight: 164 };
  const heading = { offsetHeight: 32 };
  const heightReference = { current: { offsetHeight: 146 } };
  const previousObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback) { onResize = callback; }
    observe() {}
    disconnect() {}
  };
  const modules = {
    react: {
      useId: () => "visible-employees",
      useRef: () => ({ current: refCursor++ === 0 ? heading : content }),
      useState(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
      },
      useLayoutEffect(callback) { effect = callback; }
    },
    "@/components/ui/Button": { Button: "Button" },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
  };
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText, url.pathname);
  const render = () => {
    cursor = 0; refCursor = 0;
    return loaded.exports.CollapsibleRow({ heightReference, title: "Staff", expandLabel: "Expand staff", collapseLabel: "Collapse staff", children: "Employees" });
  };
  try {
    render();
    cleanup = effect();
    let tree = render();
    let button = tree.props.children[0].props.children[1];
    assert.equal(button.props["aria-expanded"], false);
    assert.equal(tree.props.children[0].props.className.includes("justify-between"), false);
    assert.match(tree.props.children[1].props.children[1].props.className, /pointer-events-none.*from-surface.*opacity-100/);
    assert.equal(button.props["aria-controls"], "visible-employees");
    assert.equal(tree.props.children[1].props.style.height, 106);
    assert.deepEqual(items.map((item) => item.inert), [false, false, false, false, false, true]);
    button.props.onClick();
    tree = render();
    cleanup(); cleanup = effect();
    assert.equal(tree.props.children[1].props.style.height, 164);
    assert.ok(items.every((item) => !item.inert));
    assert.match(tree.props.children[1].props.children[1].props.className, /opacity-0/);
    button = tree.props.children[0].props.children[1];
    assert.equal(button.props["aria-label"], "Collapse staff");
    button.props.onClick();
    render(); cleanup(); cleanup = effect();
    tree = render();
    assert.equal(tree.props.children[1].props.style.height, 106);
    assert.match(tree.props.children[1].props.className, /transition-\[height\].*duration-300.*motion-reduce:transition-none/);
    items.forEach((item) => { item.offsetTop = 0; });
    content.scrollHeight = 50;
    onResize();
    tree = render();
    assert.equal(tree.props.children[0].props.children[1], null);
    assert.ok(items.every((item) => !item.inert));
    items.length = 0;
    content.scrollHeight = 4;
    onResize();
    tree = render();
    assert.equal(tree.props.children[0].props.children[1], null);
  } finally {
    cleanup?.();
    globalThis.ResizeObserver = previousObserver;
  }
});
