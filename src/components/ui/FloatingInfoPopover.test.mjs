import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

test("information popovers open on tap or keyboard focus and dismiss on Escape or blur", () => {
  let isOpen = false;
  let cursor = 0;
  const modules = {
    react: {
      useRef: () => ({ current: null }),
      useEffect: () => {},
      useState: () => cursor++ === 0 ? [isOpen, (value) => { isOpen = value; }] : [null, () => {}]
    },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
  };
  const url = new URL("./FloatingInfoPopover.tsx", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, url.pathname);
  function trigger() {
    cursor = 0;
    return loaded.exports.FloatingInfoPopover({ ariaLabel: "Tag information", content: "Legend", children: "i" }).props.children[0];
  }
  trigger().props.onClick();
  assert.equal(isOpen, true);
  trigger().props.onKeyDown({ key: "Escape" });
  assert.equal(isOpen, false);
  trigger().props.onFocus();
  assert.equal(isOpen, true);
  trigger().props.onBlur();
  assert.equal(isOpen, false);
});

for (const theme of ["theme-coral", "theme-blue", "theme-sage"]) {
  test(`portal popovers inherit ${theme} so all semantic badge colors match the originating screen`, () => {
    const states = [], refs = [], effects = [];
    let stateIndex = 0, refIndex = 0;
    let activeTheme = theme;
    const oldWindow = globalThis.window;
    const oldDocument = globalThis.document;
    globalThis.window = { innerHeight: 900, innerWidth: 1200, addEventListener() {}, removeEventListener() {} };
    globalThis.document = { body: {} };
    const modules = {
      react: {
        useRef: (initial) => refs[refIndex++] ??= { current: initial },
        useEffect: (effect) => { effects.push(effect); },
        useState(initial) {
          const index = stateIndex++;
          if (!(index in states)) states[index] = initial;
          return [states[index], (value) => { states[index] = value; }];
        }
      },
      "react-dom": { createPortal: (content) => content },
      "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
    };
    const url = new URL("./FloatingInfoPopover.tsx", import.meta.url);
    const loaded = new Module(url.pathname);
    loaded.filename = url.pathname;
    loaded.require = (name) => modules[name] ?? require(name);
    loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, url.pathname);
    function render() {
      stateIndex = 0; refIndex = 0; effects.length = 0;
      return loaded.exports.FloatingInfoPopover({ ariaLabel: "Information", content: "All badges", children: "i" });
    }
    try {
      let tree = render();
      refs[0].current = { closest: () => ({ classList: ["app-shell", activeTheme] }), getBoundingClientRect: () => ({ left: 100, top: 100, bottom: 124, width: 24 }) };
      tree.props.children[0].props.onClick();
      render();
      refs[1].current = { offsetWidth: 100, offsetHeight: 44 };
      effects.at(-1)();
      tree = render();
      assert.ok(tree.props.children[1].props.className.split(" ").includes(theme));
      assert.equal(tree.props.children[1].props.children, "All badges");
      assert.match(tree.props.children[1].props.className, /w-fit max-w-64/);
      assert.equal(tree.props.children[1].props.style.left, 62);
      assert.equal(tree.props.children[1].props.style.maxWidth, "min(16rem, calc(100vw - 24px))");
      tree.props.children[0].props.onBlur(); render();
      activeTheme = theme === "theme-blue" ? "theme-sage" : "theme-blue";
      tree.props.children[0].props.onClick(); render(); effects.at(-1)();
      tree = render();
      assert.ok(tree.props.children[1].props.className.split(" ").includes(activeTheme));
    } finally {
      globalThis.window = oldWindow;
      globalThis.document = oldDocument;
    }
  });
}
