import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import * as templates from "../message-templates.ts";
import * as planLimits from "../plan-limits.ts";

const require = createRequire(import.meta.url);
const { FaWhatsapp } = require("react-icons/fa");
const url = new URL("./MessageTemplatesView.tsx", import.meta.url);
const output = ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

function harness({ failLoad = false, failSave = false, failCopy = false, props = {} } = {}) {
  const states = [], refs = [], effects = [], timers = [];
  let stateIndex = 0, refIndex = 0;
  const saved = [], deleted = [], copied = [];
  const modules = {
    react: {
      useState(initial) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
        return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
      },
      useRef(initial) { const index = refIndex++; return refs[index] ??= { current: initial }; },
      useEffect(effect) { effects.push(effect); }
    },
    "@/features/scheduling/message-templates": templates,
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
    "@/lib/networking/endpoints/message-templates": {
      getMessageTemplates: async () => { if (failLoad) throw new Error("Unavailable"); return []; },
      saveMessageTemplate: async (businessId, template) => { if (failSave) throw new Error("Unavailable"); saved.push({ businessId, template }); },
      deleteMessageTemplate: async (businessId, id) => { deleted.push({ businessId, id }); }
    }
  };
  for (const component of ["Button", "Card", "Modal", "SelectField", "TextAreaField", "TextField"]) modules[`@/components/ui/${component}`] = { [component]: component };
  modules["@/components/composed/SectionHeader"] = { SectionHeader: "SectionHeader" };
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(output, url.pathname);
  const previousWindow = globalThis.window;
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  globalThis.window = { location: { origin: "https://example.com" }, setTimeout: (callback) => { timers.push(callback); return 1; }, clearTimeout: () => {}, requestAnimationFrame: (callback) => callback(), confirm: () => true };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async (value) => { if (failCopy) throw new Error("Denied"); copied.push(value); } } } });
  let tree;
  const baseProps = { businessId: "business", businessName: "My clinic", businessSlug: "my-clinic", locale: "es", services: [{ id: "service", name: "Consultation", publicSlug: "consulta", isVisible: true, isArchived: false }], ...props };
  function render() { stateIndex = 0; refIndex = 0; effects.length = 0; tree = loaded.exports.MessageTemplatesView(baseProps); return tree; }
  function nodes(node = tree) {
    if (!node || typeof node !== "object") return [];
    const children = [node.props?.children, node.props?.actions].flat(Infinity);
    return [node, ...children.filter((child) => child && typeof child === "object").flatMap((child) => nodes(child))];
  }
  function find(type, predicate = () => true) { return nodes().find((node) => node.type === type && predicate(node.props)); }
  function button(label) { return find("Button", (props) => props.children === label); }
  async function load() { render(); effects[0](); timers.shift()(); await new Promise((resolve) => setImmediate(resolve)); render(); }
  return {
    render, find, button, nodes, load, saved, deleted, copied, timers,
    close() {
      globalThis.window = previousWindow;
      if (previousNavigator) Object.defineProperty(globalThis, "navigator", previousNavigator);
      else delete globalThis.navigator;
    }
  };
}

test("messages can be personalized, previewed, copied, saved, updated and deleted", async () => {
  const app = harness();
  try {
    app.render();
    assert.ok(app.nodes().some((node) => node.props?.role === "status"));
    await app.load();
    assert.equal(app.button("Guardar plantilla").props.disabled, false);
    app.find("TextField").props.onChange({ target: { value: "My template" } });
    app.render();
    app.find("TextAreaField").props.onChange({ target: { value: "Welcome {{negocio}}\n{{servicio}}\n{{link}}" } });
    app.render();
    assert.equal(app.button("Copiar mensaje").props.disabled, true);
    app.find("SelectField").props.onChange({ target: { value: "service" } });
    app.render();
    await app.button("Copiar mensaje").props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(app.copied, ["Welcome My clinic\nConsultation\nhttps://example.com/my-clinic/consulta"]);
    app.button("Guardar plantilla").props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    app.render();
    assert.equal(app.saved.length, 1);
    assert.equal(app.saved[0].businessId, "business");
    assert.equal(app.saved[0].template.title, "My template");
    const id = app.saved[0].template.id;
    app.button("Guardar plantilla").props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    app.render();
    assert.equal(app.saved[1].template.id, id);
    app.button("Eliminar").props.onClick();
    app.render();
    assert.equal(app.find("Modal").props.isOpen, true);
    app.find("Button", (props) => props.variant === "danger").props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    app.render();
    assert.deepEqual(app.deleted, [{ businessId: "business", id }]);
    assert.equal(app.find("Modal").props.isOpen, false);
  } finally { app.close(); }
});

test("failed saved-template loading leaves copying available and offers retry", async () => {
  const app = harness({ failLoad: true });
  try {
    await app.load();
    assert.ok(app.button("Reintentar"));
    assert.equal(app.button("Guardar plantilla").props.disabled, true);
    assert.equal(app.button("Copiar mensaje").props.disabled, false);
    app.button("Copiar mensaje").props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(app.copied.length, 1);
  } finally { app.close(); }
});

test("WhatsApp branding appears in the page heading, chat preview and copy action", async () => {
  const app = harness();
  try {
    await app.load();
    assert.equal(app.find("SectionHeader").props.title, "Mensajes de WhatsApp");
    assert.equal(app.find("SectionHeader").props.icon.type, FaWhatsapp);
    assert.equal(app.nodes().filter((node) => node.type === FaWhatsapp).length, 1);
    const startersTitle = app.find("h2", (props) => props.children === "Para empezar");
    assert.ok(startersTitle);
    assert.equal(app.nodes().some((node) => node.props?.children === "WhatsApp"), false);
    assert.equal(app.button("Copiar mensaje").props.icon.type, FaWhatsapp);
  } finally { app.close(); }
});

test("failed saves preserve the draft and report an actionable error", async () => {
  const app = harness({ failSave: true });
  try {
    await app.load();
    const before = app.find("TextAreaField").props.value;
    app.button("Guardar plantilla").props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    app.render();
    assert.equal(app.find("TextAreaField").props.value, before);
    assert.ok(app.nodes().some((node) => node.props?.role === "alert"));
    assert.equal(app.saved.length, 0);
  } finally { app.close(); }
});

test("message service links respect public visibility, archived services and Free plan caps", () => {
  const pageUrl = new URL("../../../app/(dashboard)/mensajes/page.tsx", import.meta.url);
  let tier = "free";
  const loaded = new Module(pageUrl.pathname);
  loaded.filename = pageUrl.pathname;
  const modules = {
    "@/features/scheduling/components/MessageTemplatesView": { MessageTemplatesView: "MessageTemplatesView" },
    "@/features/scheduling/plan-limits": planLimits,
    "@/features/scheduling/components/SchedulingProvider": { useScheduling: () => ({
      businessId: "business", locale: "es", profile: { businessName: "Clinic", businessSlug: "clinic", subscriptionTier: tier },
      services: [
        { id: "c", name: "C", isVisible: true },
        { id: "a", name: "A", isVisible: true },
        { id: "b", name: "B", isVisible: true },
        { id: "hidden", name: "Hidden", isVisible: false },
        { id: "archived", name: "Archived", isVisible: true, isArchived: true }
      ]
    }) }
  };
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(pageUrl, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, pageUrl.pathname);
  assert.deepEqual(loaded.exports.default().props.services.map((service) => service.id), ["a", "b"]);
  tier = "pro";
  assert.deepEqual(loaded.exports.default().props.services.map((service) => service.id), ["c", "a", "b"]);
});


test("copy feedback stays in its button, shows loading, success and then resets", async () => {
  const app = harness();
  try {
    await app.load();
    app.button("Copiar mensaje").props.onClick();
    app.render();
    assert.equal(app.button("Copiando…").props.isLoading, true);
    assert.equal(app.button("Copiando…").props.disabled, true);
    await new Promise((resolve) => setImmediate(resolve));
    app.timers.shift()();
    app.render();
    assert.ok(app.button("¡Copiado!"));
    assert.equal(app.nodes().some((node) => node.props?.role === "status"), false);
    app.timers.shift()();
    app.render();
    assert.equal(app.button("Copiar mensaje").props.disabled, false);
  } finally { app.close(); }
});

test("clipboard failure shows an error next to the copy button and permits retry", async () => {
  const app = harness({ failCopy: true });
  try {
    await app.load();
    app.button("Copiar mensaje").props.onClick();
    await new Promise((resolve) => setImmediate(resolve));
    app.render();
    assert.equal(app.button("Copiar mensaje").props.disabled, false);
    assert.ok(app.find("p", (props) => props.role === "alert" && props.className.includes("text-center")));
  } finally { app.close(); }
});
