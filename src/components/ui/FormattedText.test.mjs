import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, modules = {}) {
  const url = new URL(path, import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  return loaded.exports;
}
const { applyTextFormat } = load("./text-format.ts");
const { FormattedText } = load("./FormattedText.tsx", {
  "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
});
const render = (value) => renderToStaticMarkup(createElement(FormattedText, { value }));

test("formatting selected text preserves surrounding content and supports removing formatting", () => {
  for (const [format, marker] of [["bold", "**"], ["underline", "__"]]) {
    const formatted = applyTextFormat("Hello world!", 6, 11, format);
    assert.equal(formatted.value, `Hello ${marker}world${marker}!`);
    assert.equal(formatted.value.slice(formatted.start, formatted.end), "world");
    assert.equal(applyTextFormat(formatted.value, formatted.start, formatted.end, format).value, "Hello world!");
    const empty = applyTextFormat("Hello", 5, 5, format);
    assert.equal(empty.start, empty.end);
    assert.equal(empty.value, `Hello${marker}${marker}`);
    const multiline = applyTextFormat("One\nTwo", 0, 7, format);
    assert.equal(applyTextFormat(multiline.value, multiline.start, multiline.end, format).value, "One\nTwo");
  }
});

test("list formatting applies to selected complete lines and can be removed", () => {
  const formatted = applyTextFormat("Intro\nOne\nTwo\nEnd", 6, 13, "list");
  assert.equal(formatted.value, "Intro\n- One\n- Two\nEnd");
  assert.equal(applyTextFormat(formatted.value, formatted.start, formatted.end, "list").value, "Intro\nOne\nTwo\nEnd");
  assert.equal(applyTextFormat("One\nTwo", 0, 4, "list").value, "- One\nTwo");
});

test("saved formatting renders semantic bold and lists with underline and line breaks", () => {
  const html = render("**Welcome**\n__Read this__\n- **First**\n- __Second__");
  assert.match(html, /<strong>Welcome<\/strong>/);
  assert.match(html, /class="underline">Read this<\/span>/);
  assert.equal((html.match(/<li>/g) ?? []).length, 2);
  assert.match(html, /<li><strong>First<\/strong><\/li>/);
  assert.match(render("**__Both__**"), /<strong><span class="underline">Both<\/span><\/strong>/);
});

test("legacy plain descriptions remain intact and arbitrary HTML cannot execute", () => {
  assert.match(render("Welcome\n*Arrive early"), /Welcome\n\*Arrive early/);
  assert.doesNotMatch(render("**Unfinished"), /<strong>/);
  const html = render('- <img src=x onerror=alert(1)>\n**<script>alert(1)</script>**');
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img/);
  assert.match(html, /<strong>&lt;script&gt;/);
});

test("toolbar buttons format the selection and restore focus without submitting the form", () => {
  const changes = [];
  const frames = [];
  const selection = [];
  const field = { selectionStart: 0, selectionEnd: 5, focus: () => selection.push("focus"), setSelectionRange: (...range) => selection.push(range) };
  const { FormattingTextArea } = load("./FormattingTextArea.tsx", {
    react: { useId: () => "description", useRef: () => ({ current: field }) },
    "@/components/ui/Button": { Button: "button" },
    "@/components/ui/TextAreaField": { TextAreaField: "textarea" },
    "@/components/ui/text-format": { applyTextFormat }
  });
  const tree = FormattingTextArea({ label: "Description", value: "Hello", labels: { bold: "Bold", underline: "Underline", list: "List" }, onChange: (value) => changes.push(value) });
  assert.equal(tree.props.children.length, 2, "the editor contains only its toolbar and textarea");
  const buttons = tree.props.children[0].props.children[1].props.children;
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => frames.push(callback);
  try {
    for (const button of buttons) {
      assert.equal(button.props["aria-controls"], "description");
      button.props.onClick();
      frames.shift()();
    }
    assert.deepEqual(changes, ["**Hello**", "__Hello__", "- Hello"]);
    assert.equal(selection.filter((value) => value === "focus").length, 3);
    const limited = FormattingTextArea({ label: "Description", value: "Hello", maxLength: 5, helperText: "5/5", labels: { bold: "Bold", underline: "Underline", list: "List" }, onChange: (value) => changes.push(value) });
    assert.equal(limited.props.children[1].props.maxLength, 5);
    assert.equal(limited.props.children[1].props.helperText, "5/5");
    for (const button of limited.props.children[0].props.children[1].props.children) button.props.onClick();
    assert.equal(changes.length, 3, "formatting cannot expand text beyond the limit");
  } finally {
    globalThis.requestAnimationFrame = original;
  }
});


test("formatted paragraphs and lists share one left aligned content flow", () => {
  const html = render("Welcome\n- First\n- Second");
  assert.match(html, /class="space-y-1 break-words text-left"/);
  assert.match(html, /<ul class="list-disc space-y-1 pl-5">/);
  assert.doesNotMatch(html, /w-fit|text-center|mx-auto/);
});

test("centered descriptions keep bullet markers inside the centered line", () => {
  const html = renderToStaticMarkup(createElement(FormattedText, { value: "Welcome\n- First\n- **Second**", align: "center" }));
  assert.match(html, /space-y-1 break-words text-center/);
  assert.match(html, /<ul class="list-disc space-y-1 list-inside">/);
  assert.match(html, /<li><strong>Second<\/strong><\/li>/);
  assert.doesNotMatch(html, /pl-5|text-left/);
});
