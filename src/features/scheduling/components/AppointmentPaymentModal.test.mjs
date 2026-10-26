import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { messages } from "../i18n/messages.ts";
import * as payment from "../appointment-payment.ts";

const require = createRequire(import.meta.url);
function setup({ saved = true, fail = false } = {}) {
  const states = [];
  let cursor = 0, tree, closed = 0;
  const confirmed = [];
  const modules = {
    react: { useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    } },
    "@/features/scheduling/appointment-payment": payment
  };
  for (const name of ["Button", "Modal", "TextAreaField", "TextField"]) modules[`@/components/ui/${name}`] = { [name]: name };
  const url = new URL("./AppointmentPaymentModal.tsx", import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText, url.pathname);
  function render() {
    cursor = 0;
    tree = loaded.exports.AppointmentPaymentModal({ amount: 1, messages: messages.es, onClose: () => { closed++; }, onConfirm: async (...args) => { confirmed.push(args); if (fail) throw new Error("Unavailable"); return saved; } });
  }
  const nodes = (node = tree) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).filter((child) => child && typeof child === "object").flatMap((child) => nodes(child))];
  const find = (type, predicate = () => true) => nodes().find((node) => node.type === type && predicate(node.props));
  const confirm = () => find("Button", (props) => props.children === messages.es.calendar.confirmPayment).props.onClick();
  const edit = (value) => { find("Button", (props) => props["aria-label"] === messages.es.calendar.editPaymentAmount).props.onClick(); render(); find("TextField").props.onChange({ target: { value } }); render(); };
  render();
  return { render, find, confirm, edit, confirmed, closed: () => closed };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("payment confirmation starts with the appointment amount and permits cancelling without saving", async () => {
  const app = setup();
  assert.equal(app.find("TextAreaField"), undefined);
  assert.equal(app.find("TextField"), undefined);
  app.find("Button", (props) => props.children === messages.es.actions.cancel).props.onClick();
  assert.equal(app.closed(), 1);
  assert.deepEqual(app.confirmed, []);
  app.confirm(); await tick();
  assert.deepEqual(app.confirmed, [[1, undefined]]);
});

test("editing reveals optional additional information and submits the new amount and comment", async () => {
  const app = setup();
  app.edit("12000.50");
  const note = app.find("TextAreaField");
  assert.equal(note.props.label, messages.es.calendar.paymentAdditionalInfo);
  assert.equal(note.props.required, undefined);
  assert.equal(note.props.maxLength, 100);
  note.props.onChange({ target: { value: "  Servicio adicional  " } }); app.render();
  app.confirm(); app.render();
  assert.equal(app.find("Button", (props) => props.children === messages.es.calendar.confirmPayment).props.isLoading, true);
  await tick();
  assert.deepEqual(app.confirmed, [[12000.5, "Servicio adicional"]]);
});

test("an adjusted payment can be confirmed without a comment, including zero", async () => {
  const app = setup(); app.edit("0"); app.confirm(); await tick();
  assert.deepEqual(app.confirmed, [[0, ""]]);
});

test("invalid amounts never submit and failed saves leave the editable draft available", async () => {
  for (const amount of ["", "-1", "1.234", "1000000000", "NaN", "Infinity"]) {
    const app = setup(); app.edit(amount); app.confirm(); await tick(); app.render();
    assert.deepEqual(app.confirmed, []);
    assert.ok(app.find("p", (props) => props.role === "alert"));
  }
  for (const options of [{ saved: false }, { fail: true }]) {
    const app = setup(options); app.edit("55"); app.confirm(); await tick(); app.render();
    assert.equal(app.find("TextField").props.value, "55");
    assert.ok(app.find("p", (props) => props.role === "alert"));
    assert.equal(app.closed(), 0);
  }
});


test("payment comment input caps pasted text at 100 characters", async () => {
  const app = setup(); app.edit("15");
  app.find("TextAreaField").props.onChange({ target: { value: "x".repeat(130) } }); app.render();
  assert.equal(app.find("TextAreaField").props.value.length, 100);
  app.confirm(); await tick();
  assert.equal(app.confirmed[0][1].length, 100);
});
