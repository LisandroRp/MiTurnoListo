import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

test("sidebar groups animate both directions, preserve independent state and remove closed links from keyboard navigation", () => {
  const states = [];
  let cursor = 0;
  const modules = {
    react: {
      useId: () => `group-${cursor}`,
      useState(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (update) => { states[index] = update(states[index]); }];
      }
    },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
  };
  const url = new URL("./NavigationSidebarGroup.tsx", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText, url.pathname);
  function render() {
    cursor = 0;
    return [true, false, false].map((defaultOpen, index) => loaded.exports.NavigationSidebarGroup({ label: `Group ${index}`, defaultOpen, isCollapsed: false, children: "Links" }));
  }
  let groups = render();
  assert.deepEqual(groups.map((group) => group.props.children[0].props["aria-expanded"]), [true, false, false]);
  groups[1].props.children[0].props.onClick();
  groups = render();
  assert.deepEqual(groups.map((group) => group.props.children[0].props["aria-expanded"]), [true, true, false]);
  const open = groups[1].props.children[1];
  assert.equal(open.props.inert, false);
  assert.match(open.props.className, /grid-rows-\[1fr\]/);
  assert.match(open.props.className, /duration-300.*motion-reduce:transition-none/);
  groups[1].props.children[0].props.onClick();
  groups = render();
  const trigger = groups[1].props.children[0];
  const closed = groups[1].props.children[1];
  assert.equal(trigger.props["aria-controls"], closed.props.id);
  assert.equal(closed.props.inert, true);
  assert.equal(closed.props["aria-hidden"], true);
  assert.match(closed.props.className, /grid-rows-\[0fr\]/);
});
