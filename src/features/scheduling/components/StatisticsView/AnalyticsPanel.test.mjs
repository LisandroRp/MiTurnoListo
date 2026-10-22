import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

function setup({ contentHeight = 500, reducedMotion = false, rightColumn = false, expandedHeight = 700, viewportWidth = 1440 } = {}) {
  const singleColumn = viewportWidth < 1280;
  const states = [], refs = [], effects = [], queued = [], frames = new Map(), animations = [], observers = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0, frameId = 0;
  let tree;
  let flushes = 0;
  const modules = {
    react: {
      useState(initial) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (update) => { states[index] = typeof update === "function" ? update(states[index]) : update; }];
      },
      useRef(initial) { return refs[refIndex++] ??= { current: initial }; },
      useId: () => "test-panel",
      useLayoutEffect(callback, dependencies) {
        const index = effectIndex++;
        const old = effects[index];
        if (!old || dependencies.some((value, key) => value !== old.dependencies[key])) queued.push(() => {
          old?.cleanup?.();
          effects[index] = { dependencies, cleanup: callback() };
        });
      }
    },
    "@/components/ui/Card": { Card: "Card" },
    "react-dom": { flushSync: (callback) => { flushes += 1; callback(); } },
    "@/components/ui/Button": { Button: "Button" },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
  };
  const url = new URL("./AnalyticsPanel.tsx", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, url.pathname);
  function animate(target, keyframes, options) {
    const animation = { target, keyframes, options, onfinish: null, cancelled: false, cancel() { this.cancelled = true; } };
    animations.push(animation);
    return animation;
  }
  const panel = {
    style: { gridColumn: "", height: "" },
    getBoundingClientRect() {
      const height = this.style.height.endsWith("rem") ? Number.parseFloat(this.style.height) * 16 : Number.parseFloat(this.style.height);
      const wide = states[1] && this.style.gridColumn !== "auto";
      return { width: singleColumn ? viewportWidth - 48 : wide ? 1000 : 490, height: height || (states[1] ? expandedHeight : 448), left: singleColumn ? 0 : rightColumn && !wide ? 510 : 0, top: !singleColumn && rightColumn && wide ? 472 : 0 };
    },
    animate: (keyframes, options) => animate("panel", keyframes, options)
  };
  panel.firstElementChild = {
    getBoundingClientRect: () => panel.getBoundingClientRect(),
    animate: (keyframes, options) => animate("card", keyframes, options)
  };
  const reservedGrowth = () => states[1] ? Math.max(0, Number.parseFloat(panel.style.height) - expandedHeight) || 0 : 0;
  const peer = {
    getBoundingClientRect: () => ({ width: 490, height: 400, left: states[1] ? 0 : 510, top: states[1] ? 800 + reservedGrowth() : 0 }),
    animate: (keyframes, options) => animate("peer", keyframes, options)
  };
  const below = {
    getBoundingClientRect: () => ({ width: 490, height: 448, left: 0, top: states[1] ? 1220 + reservedGrowth() : 472 }),
    animate: (keyframes, options) => animate("below", keyframes, options)
  };
  const container = {
    children: [panel, peer, below],
    getBoundingClientRect: () => ({ width: 1000, height: states[1] ? 1668 + reservedGrowth() : 920, left: 0, top: 0 }),
    animate: (keyframes, options) => animate("container", keyframes, options)
  };
  panel.parentElement = container;
  const content = {
    get scrollHeight() { return contentHeight; },
    get clientHeight() { return states[0] ? contentHeight : Math.min(contentHeight, 288); }
  };
  const previousWindow = globalThis.window;
  const previousObserver = globalThis.ResizeObserver;
  globalThis.window = {
    matchMedia: (query) => ({ matches: query === "(min-width: 1280px)" ? !singleColumn : reducedMotion }),
    requestAnimationFrame: (callback) => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: (id) => frames.delete(id),
    addEventListener: () => {}, removeEventListener: () => {}
  };
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  const children = (expanded) => expanded ? "two columns" : "one column";
  function render() {
    stateIndex = 0; refIndex = 0; effectIndex = 0;
    tree = loaded.exports.AnalyticsPanel({ title: "Team", description: "Details", controls: { expandPanel: "Expand", collapsePanel: "Collapse" }, children });
    refs[0].current = panel; refs[1].current = content; refs[2].current = {};
    queued.splice(0).forEach((effect) => effect());
    return tree;
  }
  function measure() {
    [...frames.values()].forEach((callback) => callback());
    frames.clear();
    render();
  }
  function button() { return tree.props.children.props.children[0].props.children[1]; }
  function region() { return tree.props.children.props.children[1]; }
  function finishSize() { animations.filter((animation) => animation.target === "card").at(-1).onfinish?.(); render(); }
  function resize(height) { contentHeight = height; observers.filter((observer) => !observer.disconnected).forEach((observer) => observer.callback()); render(); }
  function close() {
    effects.forEach((effect) => effect.cleanup?.());
    globalThis.window = previousWindow;
    globalThis.ResizeObserver = previousObserver;
  }
  render(); measure();
  return { render, button, region, finishSize, resize, animations, panel, peer, close, get flushes() { return flushes; }, get tree() { return tree; } };
}

test("panels show expansion controls only when the collapsed content actually overflows", () => {
  const app = setup({ contentHeight: 200 });
  try {
    assert.equal(app.button(), null);
    app.resize(288);
    assert.equal(app.button(), null);
    app.resize(500);
    assert.equal(app.button().props["aria-expanded"], false);
    assert.equal(app.button().props["aria-controls"], app.region().props.id);
    app.resize(160);
    assert.equal(app.button(), null);
  } finally { app.close(); }
});

test("panels keep the full-width space until shrinking finishes, then animate neighboring panels into place", () => {
  const app = setup();
  try {
    assert.match(app.region().props.className, /max-h-72/);
    assert.match(app.tree.props.className, /h-\[28rem\]/);
    assert.match(app.tree.props.children.props.className, /flex h-full min-h-0 flex-col/);
    app.button().props.onClick();
    app.render();
    assert.match(app.tree.props.className, /xl:col-span-2/);
    assert.equal(app.region().props.children.props.children, "two columns");
    assert.equal(app.button().props["aria-label"], "Collapse: Team");
    const opening = app.animations.find((animation) => animation.target === "card");
    assert.equal(opening.keyframes[0].width, "490px");
    assert.equal(opening.keyframes[1].width, "1000px");
    const openingMovement = app.animations.find((animation) => animation.target === "panel");
    assert.equal(openingMovement.options.duration, 400);
    assert.equal(openingMovement.options.easing, "ease-in-out");
    app.finishSize();
    const priorPeerAnimations = app.animations.filter((animation) => animation.target === "peer").length;
    app.button().props.onClick();
    app.render();
    assert.equal(app.button().props.disabled, true);
    assert.match(app.tree.props.className, /xl:col-span-2/);
    assert.equal(app.peer.getBoundingClientRect().top, 800);
    assert.equal(app.panel.style.height, "700px");
    assert.equal(app.animations.filter((animation) => animation.target === "peer").length, priorPeerAnimations);
    const closing = app.animations.filter((animation) => animation.target === "card").at(-1);
    assert.equal(closing.keyframes[0].width, "1000px");
    assert.equal(closing.keyframes[1].width, "490px");
    assert.equal(closing.keyframes[1].height, "448px");
    assert.equal(closing.options.duration, 400);
    assert.equal(closing.options.delay, 0);
    assert.equal(closing.options.easing, "ease-in-out");
    app.finishSize();
    assert.doesNotMatch(app.tree.props.className, /xl:col-span-2/);
    assert.equal(app.panel.style.height, "");
    assert.equal(app.flushes, 1);
    assert.match(app.tree.props.className, /h-\[28rem\]/);
    assert.equal(app.peer.getBoundingClientRect().top, 0);
    const reposition = app.animations.filter((animation) => animation.target === "peer").at(-1);
    assert.equal(reposition.keyframes[0].transform, "translate(-510px, 800px)");
    assert.equal(reposition.keyframes[1].transform, "translate(0, 800px)");
    assert.equal(reposition.options.duration, 200);
    assert.equal(reposition.options.easing, "ease-in-out");
    assert.equal(app.button().props.disabled, false);
    assert.equal(app.region().props.children.props.children, "one column");
  } finally { app.close(); }
});

test("closing a right-hand panel animates the grid footprint alongside the lower panels", () => {
  const app = setup({ rightColumn: true });
  try {
    app.button().props.onClick(); app.render();
    app.finishSize();
    const beforeClose = app.animations.length;
    app.button().props.onClick(); app.render();
    assert.equal(app.animations.slice(beforeClose).some((animation) => animation.target === "container"), false);
    app.finishSize();
    const closingAnimations = app.animations.slice(beforeClose);
    const grid = closingAnimations.find((animation) => animation.target === "container");
    const below = closingAnimations.find((animation) => animation.target === "below");
    assert.deepEqual(grid.keyframes, [{ height: "1668px" }, { height: "920px" }]);
    assert.equal(below.keyframes[0].transform, "translate(0px, 748px)");
    assert.equal(grid.options.duration, below.options.duration);
    assert.equal(grid.options.easing, below.options.easing);
    const selected = closingAnimations.find((animation) => animation.target === "panel");
    assert.equal(below.options.delay ?? 0, 0);
    assert.equal(selected.options.delay ?? 0, 0);
    assert.equal(selected.options.duration, 500);
    assert.equal(selected.options.fill, "backwards");
    assert.equal(grid.options.delay ?? 0, 0);
  } finally { app.close(); }
});

test("closing a short expanded panel moves lower panels down before the card grows, then brings them back up", () => {
  const app = setup({ rightColumn: true, expandedHeight: 320 });
  try {
    app.button().props.onClick(); app.render(); app.finishSize();
    const beforeClose = app.animations.length;
    app.button().props.onClick(); app.render();
    const clearance = app.animations.slice(beforeClose).find((animation) => animation.target === "below");
    const size = app.animations.filter((animation) => animation.target === "card").at(-1);
    assert.equal(app.panel.style.height, "472px");
    assert.equal(clearance.keyframes[0].transform, "translate(0px, -152px)");
    assert.equal(size.options.delay, clearance.options.duration);
    assert.equal(size.keyframes[0].height, "320px");
    assert.equal(size.keyframes[1].height, "448px");
    assert.equal(size.options.duration, 400);
    app.finishSize();
    const returning = app.animations.filter((animation) => animation.target === "below").at(-1);
    assert.notEqual(returning, clearance);
    assert.equal(returning.keyframes[0].transform, "translate(0px, 900px)");
    assert.equal(returning.options.delay, 200);
    assert.equal(returning.options.fill, "backwards");
    assert.equal(returning.options.duration, 500);
    const selected = app.animations.filter((animation) => animation.target === "panel").at(-1);
    const container = app.animations.filter((animation) => animation.target === "container").at(-1);
    assert.equal(selected.options.delay, 0);
    assert.equal(container.options.delay, returning.options.delay);
    assert.equal(container.options.fill, "backwards");
    assert.equal(app.panel.style.height, "");
  } finally { app.close(); }
});

for (const rightColumn of [false, true]) {
  test(`opening a ${rightColumn ? "right" : "left"}-hand panel preserves its stagger before moving and expanding`, () => {
    const app = setup({ rightColumn });
    try {
      app.button().props.onClick(); app.render();
      const below = app.animations.find((animation) => animation.target === "below");
      const selected = app.animations.find((animation) => animation.target === "panel");
      const size = app.animations.find((animation) => animation.target === "card");
      assert.equal(below.options.delay ?? 0, 0);
      assert.equal(below.options.duration, rightColumn ? 500 : 700);
      assert.equal(selected.options.delay, rightColumn ? below.options.duration : 350);
      assert.equal(size.options.delay, selected.options.delay);
      if (!rightColumn) assert.ok(size.options.delay < below.options.duration);
      assert.equal(selected.options.fill, "backwards");
      assert.equal(size.options.fill, "both");
      assert.equal(selected.options.duration, 400);
      assert.equal(size.options.duration, 400);
      app.finishSize();
      app.button().props.onClick(); app.render(); app.finishSize();
      const returning = app.animations.filter((animation) => animation.target === "below").at(-1);
      assert.equal(returning.options.duration, rightColumn ? 500 : 200);
    } finally { app.close(); }
  });
}

for (const viewportWidth of [390, 899, 1279]) {
  test(`stacked panels at ${viewportWidth}px animate their height in normal flow without the desktop sequence`, () => {
    const app = setup({ viewportWidth });
    try {
      app.button().props.onClick(); app.render();
      assert.equal(app.animations.length, 1);
      const opening = app.animations[0];
      assert.equal(opening.target, "panel");
      assert.deepEqual(opening.keyframes, [
        { height: "448px", overflow: "hidden" },
        { height: "700px", overflow: "hidden" }
      ]);
      assert.equal(opening.options.delay ?? 0, 0);
      assert.equal(opening.options.duration, 400);
      assert.equal(app.panel.style.height, "");
      app.button().props.onClick(); app.render();
      assert.equal(opening.cancelled, true);
      assert.equal(app.animations.length, 2);
      const closing = app.animations[1];
      assert.equal(closing.target, "panel");
      assert.deepEqual(closing.keyframes, [
        { height: "700px", overflow: "hidden" },
        { height: "448px", overflow: "hidden" }
      ]);
      assert.equal(closing.options.delay ?? 0, 0);
      assert.equal(app.flushes, 0);
      assert.equal(app.button().props.disabled, false);
      assert.doesNotMatch(app.tree.props.className, /xl:col-span-2/);
    } finally { app.close(); }
  });
}

test("panels at the desktop breakpoint retain the two-column animation sequence", () => {
  const app = setup({ viewportWidth: 1280, rightColumn: true });
  try {
    app.button().props.onClick(); app.render();
    const card = app.animations.find((animation) => animation.target === "card");
    assert.equal(card.options.delay, 500);
    assert.equal(card.keyframes[0].width, "490px");
    assert.equal(card.keyframes[1].width, "1000px");
    assert.ok(app.animations.some((animation) => animation.target === "below"));
  } finally { app.close(); }
});

test("stacked panels respect reduced motion", () => {
  const app = setup({ viewportWidth: 899, reducedMotion: true });
  try {
    app.button().props.onClick(); app.render();
    app.button().props.onClick(); app.render();
    assert.equal(app.animations.length, 0);
    assert.equal(app.button().props["aria-expanded"], false);
    assert.equal(app.button().props.disabled, false);
  } finally { app.close(); }
});

test("reduced motion closes immediately, and shrinking data still leaves a close control while expanded", () => {
  const app = setup({ reducedMotion: true });
  try {
    app.button().props.onClick(); app.render();
    app.resize(100);
    assert.ok(app.button());
    app.button().props.onClick(); app.render();
    assert.doesNotMatch(app.tree.props.className, /xl:col-span-2/);
    app.resize(100);
    assert.equal(app.button(), null);
    assert.equal(app.animations.length, 0);
  } finally { app.close(); }
});
