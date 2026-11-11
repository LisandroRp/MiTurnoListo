import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { getDropdownMotionFrames } from "./useDropdownMotion.ts";

const require = createRequire(import.meta.url);
const triggerRect = { left: 260, right: 420, top: 100, width: 160, height: 40 };
const contentRect = { left: 100, right: 420, top: 148, width: 320, height: 180 };
const full = "inset(0px 0px 0px 0px)";

test("vertical motion reveals the full width and closes toward the trigger from either side", () => {
  const below = getDropdownMotionFrames(contentRect, triggerRect, "vertical", true);
  assert.deepEqual(below, [{ opacity: 0, clipPath: "inset(0px 0px 180px 0px)" }, { opacity: 1, clipPath: full }]);
  const above = getDropdownMotionFrames({ ...contentRect, top: 10 }, { ...triggerRect, top: 200 }, "vertical", false);
  assert.deepEqual(above, [{ opacity: 1, clipPath: full }, { opacity: 1, clipPath: "inset(180px 0px 0px 0px)" }]);
});

test("diagonal motion grows down and left from the button's footprint without scaling text", () => {
  const opening = getDropdownMotionFrames(contentRect, triggerRect, "diagonal", true);
  const closing = getDropdownMotionFrames(contentRect, triggerRect, "diagonal", false);
  assert.equal(opening[0].clipPath, "inset(0px 0px 180px 160px)");
  assert.equal(opening[1].clipPath, full);
  assert.equal(closing[0].clipPath, full);
  assert.equal(closing[1].clipPath, opening[0].clipPath);
  assert.ok(closing.every((frame) => frame.opacity === 1));
  assert.ok([...opening, ...closing].every((frame) => !("transform" in frame)));
});

test("diagonal motion supports mirrored alignment, menus above the trigger and wider triggers", () => {
  const mirrored = getDropdownMotionFrames(contentRect, { ...triggerRect, left: 100, right: 260 }, "diagonal", false);
  assert.equal(mirrored[1].clipPath, "inset(0px 160px 180px 0px)");
  const above = getDropdownMotionFrames({ ...contentRect, top: 0 }, { ...triggerRect, top: 200 }, "diagonal", false);
  assert.equal(above[1].clipPath, "inset(180px 0px 0px 160px)");
  const wider = getDropdownMotionFrames(contentRect, { ...triggerRect, left: 0, right: 500 }, "diagonal", true);
  assert.equal(wider[0].clipPath, "inset(0px 0px 180px 0px)");
});

function setup(variant = "vertical", reducedMotion = false) {
  const previousWindow = globalThis.window;
  const states = [], effects = new Map(), pending = new Map(), frames = new Map(), timers = new Map(), animations = [];
  let cursor = 0, dirty = false, nextId = 0, clock = 0, result;
  const contentBox = { ...contentRect }, triggerBox = { ...triggerRect };
  const content = { style: { opacity: "" }, getBoundingClientRect: () => contentBox, animate(keyframes, timing) {
    let complete;
    const animation = { keyframes, timing, cancelled: false, finished: new Promise((resolve) => { complete = resolve; }), complete: () => complete(), cancel() { this.cancelled = true; } };
    animations.push(animation); return animation;
  } };
  const props = { isOpen: false, variant, ready: true, contentRef: { current: content }, triggerRef: { current: { getBoundingClientRect: () => triggerBox } } };
  globalThis.window = {
    matchMedia: () => ({ matches: reducedMotion }),
    requestAnimationFrame: (callback) => { const id = ++nextId; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, at: clock + delay }); return id; },
    clearTimeout: (id) => timers.delete(id)
  };
  const modules = { react: {
    useState: (initial) => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], (value) => { if (states[index] !== value) { states[index] = value; dirty = true; } }]; },
    useLayoutEffect: (callback, deps) => pending.set(cursor++, { callback, deps })
  } };
  const url = new URL("./useDropdownMotion.ts", import.meta.url), loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  function render() {
    let renders = 0;
    do {
      if (++renders > 10) throw new Error("Render loop");
      cursor = 0; dirty = false; pending.clear(); result = loaded.exports.useDropdownMotion(props);
      if (dirty) continue;
      for (const [index, effect] of pending) {
        const previous = effects.get(index);
        if (previous && effect.deps.every((value, i) => Object.is(value, previous.deps[i]))) continue;
        previous?.cleanup?.(); effects.set(index, { deps: effect.deps, cleanup: effect.callback() });
      }
    } while (dirty);
    return result;
  }
  function flushFrame() { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } }
  function advance(milliseconds) { clock += milliseconds; for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.callback(); } return render(); }
  render();
  return { props, render, result: () => result, flushFrame, advance, animations, contentBox, triggerBox, content, frames, timers, restore() { for (const effect of effects.values()) effect.cleanup?.(); globalThis.window = previousWindow; } };
}

for (const variant of ["vertical", "diagonal"]) {
  test(`${variant} shares entry, retained exit and current-geometry closing after repositioning`, () => {
    const app = setup(variant);
    try {
      assert.equal(app.result().isPresent, false);
      app.props.isOpen = true; app.render();
      assert.equal(app.result().isPresent, true);
      assert.equal(app.content.style.opacity, "0");
      app.flushFrame();
      assert.equal(app.animations[0].timing.easing, "ease-out");
      assert.deepEqual(app.animations[0].keyframes, getDropdownMotionFrames(app.contentBox, app.triggerBox, variant, true));
      app.contentBox.top = 0; app.triggerBox.top = 200;
      app.props.isOpen = false; app.render();
      const exit = app.animations.at(-1);
      assert.equal(app.animations[0].cancelled, true);
      assert.equal(exit.timing.duration, 150);
      assert.deepEqual(exit.keyframes, getDropdownMotionFrames(app.contentBox, app.triggerBox, variant, false));
      assert.equal(app.advance(149).isPresent, true);
      assert.equal(app.advance(1).isPresent, false);
      assert.equal(app.content.style.opacity, "");
    } finally { app.restore(); }
  });
}

test("entry waits until layout is ready and measures geometry in the next animation frame", () => {
  const app = setup("diagonal");
  try {
    app.props.ready = false; app.props.isOpen = true; app.render();
    assert.equal(app.frames.size, 0); assert.equal(app.animations.length, 0);
    app.props.ready = true; app.render();
    app.contentBox.left = 0; app.contentBox.width = 420;
    app.flushFrame();
    assert.equal(app.animations[0].keyframes[0].clipPath, "inset(0px 0px 180px 260px)");
  } finally { app.restore(); }
});

test("reopening cancels a pending exit and unmounting cancels queued animation frames", () => {
  const app = setup();
  try {
    app.props.isOpen = true; app.render(); app.flushFrame();
    app.props.isOpen = false; app.render();
    const exit = app.animations.at(-1);
    app.advance(75); app.props.isOpen = true; app.render();
    assert.equal(exit.cancelled, true); assert.equal(app.timers.size, 0);
    assert.equal(app.result().isPresent, true); assert.equal(app.frames.size, 1);
  } finally { app.restore(); }
  assert.equal(app.frames.size, 0);
});

test("motion reduction skips entry and exits without the animation delay", () => {
  const app = setup("diagonal", true);
  try {
    app.props.isOpen = true; app.render(); app.flushFrame();
    assert.equal(app.animations.length, 0); assert.equal(app.content.style.opacity, "");
    app.props.isOpen = false; app.render();
    assert.equal(app.advance(0).isPresent, false);
  } finally { app.restore(); }
});

test("finishing an entry clears its fill effect so the open panel can resize normally", async () => {
  const app = setup();
  try {
    app.props.isOpen = true; app.render(); app.flushFrame();
    app.animations[0].complete(); await Promise.resolve();
    assert.equal(app.animations[0].cancelled, true);
    assert.equal(app.content.style.opacity, "");
    assert.equal(app.result().isPresent, true);
  } finally { app.restore(); }
});


test("the shared button passes its DOM ref through for dropdown anchor measurement", () => {
  const url = new URL("./Button.tsx", import.meta.url), loaded = new Module(url.pathname);
  loaded.require = (name) => name === "@/components/ui/utils" ? { cx: (...values) => values.filter(Boolean).join(" ") } : require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, url.pathname);
  const ref = { current: null };
  const button = loaded.exports.Button({ ref, children: "Open" });
  assert.equal(button.props.ref, ref);
});

test("clearing placement readiness while closing still completes the exit and unmounts", () => {
  const app = setup();
  try {
    app.props.isOpen = true; app.render(); app.flushFrame();
    app.props.isOpen = false; app.props.ready = false; app.render();
    assert.equal(app.animations.at(-1).timing.easing, "ease-in");
    assert.equal(app.advance(150).isPresent, false);
  } finally { app.restore(); }
});
