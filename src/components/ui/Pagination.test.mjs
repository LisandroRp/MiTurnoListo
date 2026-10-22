import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const url = new URL("./Pagination.tsx", import.meta.url);
const loaded = new Module(url.pathname);
loaded.filename = url.pathname;
loaded.require = (name) => name === "@/components/ui/Button" ? { Button: "Button" } : require(name);
loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS }
}).outputText, url.pathname);

function render(currentPage, totalItems) {
  const changes = [];
  const tree = loaded.exports.Pagination({
    currentPage, totalItems, pageSize: 20, onPageChange: (page) => changes.push(page),
    labels: { summary: "{from}-{to} of {total}", previous: "Previous", next: "Next", navigation: "Bookings" }
  });
  const [summary, controls] = tree.props.children;
  const [previous, pages, next] = controls.props.children;
  return { tree, summary, previous, pages, next, changes };
}

test("pagination bounds navigation, limits page buttons and announces the visible range", () => {
  const first = render(1, 203);
  assert.equal(first.previous.props.disabled, true);
  assert.equal(first.next.props.disabled, false);
  assert.equal(first.summary.props.children, "1-20 of 203");
  assert.equal(first.summary.props["aria-live"], "polite");
  assert.equal(first.tree.props["aria-label"], "Bookings");
  assert.equal(first.pages.length, 5);
  assert.equal(first.pages[0].props["aria-current"], "page");
  first.next.props.onClick();
  first.pages[3].props.onClick();
  assert.deepEqual(first.changes, [2, 4]);
  const last = render(11, 203);
  assert.equal(last.next.props.disabled, true);
  assert.equal(last.summary.props.children, "201-203 of 203");
  assert.deepEqual(last.pages.map((page) => page.props.children), [7, 8, 9, 10, 11]);
  last.previous.props.onClick();
  assert.deepEqual(last.changes, [10]);
});

test("empty and reduced datasets keep pagination within the available page range", () => {
  const empty = render(4, 0);
  assert.equal(empty.summary.props.children, "0-0 of 0");
  assert.equal(empty.previous.props.disabled, true);
  assert.equal(empty.next.props.disabled, true);
  const reduced = render(10, 23);
  assert.equal(reduced.summary.props.children, "21-23 of 23");
  assert.equal(reduced.next.props.disabled, true);
  assert.equal(reduced.pages.at(-1).props["aria-current"], "page");
});
