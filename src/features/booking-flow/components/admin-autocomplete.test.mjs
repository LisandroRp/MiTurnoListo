import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { messages } from "../../scheduling/i18n/messages.ts";

const require = createRequire(import.meta.url);
function harness(path, name, initialProps) {
  const states = [];
  let cursor = 0, dirty = false, tree;
  const modules = {
    react: { useId: () => `field-${cursor++}`, useState: (initial) => { const index = cursor++; if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial; return [states[index], (update) => { const next = typeof update === "function" ? update(states[index]) : update; if (!Object.is(next, states[index])) { states[index] = next; dirty = true; } }]; }, useRef: () => ({ current: null }), useEffect: () => {} },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
    "@/components/ui/useDropdownMotion": { useDropdownMotion: ({ isOpen }) => ({ isPresent: isOpen }) },
    "@/features/scheduling/plan-limits": { isFreePlan: () => false },
    "@/features/scheduling/utils/format": { formatCurrency: (value) => String(value) },
    "@/features/booking-flow/components/CustomerLookupField": { CustomerLookupField: "CustomerLookupField" }
  };
  for (const name of ["TextField", "Card", "CheckboxField", "Button", "SelectField", "Modal"]) modules[`@/components/ui/${name}`] = { [name]: name };
  const url = new URL(path, import.meta.url), loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? (name.startsWith("@/") ? {} : require(name));
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  const props = { messages: messages.es, ...initialProps };
  function render() { let attempts = 0; do { if (++attempts > 10) throw new Error("Render loop"); cursor = 0; dirty = false; tree = loaded.exports[name](props); } while (dirty); }
  const nodes = (node = tree) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).filter(Boolean).flatMap((child) => nodes(child))];
  render(); return { props, render, nodes };
}

for (const disabled of [false, true]) {
  test(`customer lookup ${disabled ? "uses the approved Chromium token" : "preserves native autocomplete"} while keeping app suggestions and selection`, () => {
    const suggestion = { id: "sample", fullName: "Sample", email: "sample@example.com", phone: "123" };
    const selected = [];
    const app = harness("./CustomerLookupField.tsx", "CustomerLookupField", { disableNativeAutocomplete: disabled, isOpen: true, isLoading: false, type: "email", value: "sample", suggestions: [suggestion], onSelect: (value) => selected.push(value) });
    const input = app.nodes().find((node) => node.type === "TextField");
    assert.equal(input.props.autoComplete, disabled ? "admin-entry" : undefined);
    if (disabled) {
      assert.match(input.props.id, /^entry-/);
      assert.equal(input.props.name, input.props.id);
      assert.doesNotMatch(input.props.name, /name|email|phone|customer/i);
    } else {
      assert.equal(input.props.id, undefined);
      assert.equal(input.props.name, undefined);
    }
    const originalIdentity = input.props.id;
    app.props.value = "changed@example.com"; app.render();
    assert.equal(app.nodes().find((node) => node.type === "TextField").props.id, originalIdentity);
    assert.equal(input.props.type, "email");
    assert.equal(input.props.inputMode, disabled ? "email" : undefined);
    assert.equal(input.props.required, true);
    app.nodes().find((node) => node.type === "button").props.onClick();
    assert.deepEqual(selected, [suggestion]);
    app.props.type = "text"; app.render();
    const nameField = app.nodes().find((node) => node.type === "TextField");
    assert.equal(nameField.props.autoComplete, disabled ? "off" : undefined);
    assert.equal(nameField.props.inputMode, undefined);
  });
}

for (const disableNativeAutocomplete of [undefined, true]) {
  test(`${disableNativeAutocomplete ? "admin" : "public"} booking details configure only customer fields and preserve lookup callbacks`, () => {
    const suggestions = [{ id: "sample", fullName: "Sample" }], selected = [], queries = [];
    const app = harness("./BookingFlow/steps/DetailsStep.tsx", "DetailsStep", {
      disableNativeAutocomplete, availablePaymentOptions: [], selectedPaymentOption: null,
      customer: { fullName: "Sample", email: "sample@example.com", phone: "123" },
      customerSuggestions: suggestions, isLoadingCustomerSuggestions: false,
      customFields: [{ id: "custom", label: "Additional detail", isRequired: false }], customFieldResponses: {},
      onCustomerSuggestionSelect: (value) => selected.push(value), onCustomerLookupQueryChange: (query) => queries.push(query)
    });
    const lookupFields = app.nodes().filter((node) => node.type === "CustomerLookupField");
    assert.equal(lookupFields.length, 2);
    for (const field of lookupFields) {
      assert.equal(field.props.disableNativeAutocomplete, Boolean(disableNativeAutocomplete));
      assert.equal(field.props.suggestions, suggestions);
    }
    const phone = app.nodes().find((node) => node.type === "TextField" && node.props.type === "tel");
    assert.equal(phone.props.autoComplete, disableNativeAutocomplete ? "off" : undefined);
    if (disableNativeAutocomplete) {
      assert.match(phone.props.id, /^entry-/);
      assert.equal(phone.props.name, phone.props.id);
      assert.doesNotMatch(phone.props.name, /name|email|phone|customer/i);
    } else {
      assert.equal(phone.props.id, undefined);
      assert.equal(phone.props.name, undefined);
    }
    const custom = app.nodes().find((node) => node.type === "TextField" && node.props.label === "Additional detail");
    assert.equal(custom.props.autoComplete, undefined);
    lookupFields[1].props.onFocus(); lookupFields[1].props.onSelect(suggestions[0]);
    assert.deepEqual(queries, ["sample@example.com"]); assert.deepEqual(selected, suggestions);
  });
}

test("admin walk-in customer fields disable browser autocomplete when customer details are enabled", () => {
  const app = harness("../../scheduling/components/WalkInAppointmentModal.tsx", "WalkInAppointmentModal", {
    businessId: "business", isOpen: true, subscriptionTier: "pro",
    employees: [{ id: "employee", isVisible: true, isArchived: false }],
    services: [{ id: "service", isVisible: true, isArchived: false, employeeIds: ["employee"] }]
  });
  app.nodes().find((node) => node.type === "CheckboxField").props.onChange({ target: { checked: true } }); app.render();
  const lookupFields = app.nodes().filter((node) => node.type === "CustomerLookupField");
  assert.equal(lookupFields.length, 2);
  assert.ok(lookupFields.every((node) => node.props.disableNativeAutocomplete === true));
  const phone = app.nodes().find((node) => node.type === "TextField" && node.props.type === "tel");
  assert.equal(phone.props.autoComplete, "off");
  assert.match(phone.props.id, /^entry-/);
  assert.equal(phone.props.name, phone.props.id);
  assert.doesNotMatch(phone.props.name, /name|email|phone|customer/i);
});


test("booking validation rejects missing and malformed emails before confirmation", () => {
  const url = new URL("./BookingFlow/utils/bookingFlowUtils.ts", import.meta.url), loaded = new Module(url.pathname);
  loaded.require = (name) => name.startsWith("@/") ? {} : require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, url.pathname);
  const draft = { customer: { fullName: "Sample", phone: "123", email: "" }, paymentOption: "cash", customFieldResponses: {} };
  assert.equal(loaded.exports.getStepValidationMessage("details", draft, messages.es), messages.es.bookingFlow.validation.emailRequired);
  for (const email of ["li", "li@", "sample@example", "sample @example.com"]) {
    draft.customer.email = email;
    assert.equal(loaded.exports.getStepValidationMessage("details", draft, messages.es), messages.es.bookingFlow.validation.emailInvalid);
  }
  draft.customer.email = "sample@example.com";
  assert.equal(loaded.exports.getStepValidationMessage("details", draft, messages.es), "");
});

test("walk-in booking stays disabled for malformed emails and accepts valid customer details", () => {
  const app = harness("../../scheduling/components/WalkInAppointmentModal.tsx", "WalkInAppointmentModal", {
    businessId: "business", isOpen: true, subscriptionTier: "pro",
    employees: [{ id: "employee", isVisible: true, isArchived: false }],
    services: [{ id: "service", isVisible: true, isArchived: false, employeeIds: ["employee"], durationMinutes: 30, price: 100 }]
  });
  const select = (label, value) => { app.nodes().find((node) => node.type === "SelectField" && node.props.label === label).props.onChange({ target: { value } }); app.render(); };
  select(messages.es.walkInAppointment.serviceLabel, "service");
  select(messages.es.walkInAppointment.employeeLabel, "employee");
  app.nodes().find((node) => node.type === "CheckboxField").props.onChange({ target: { checked: true } }); app.render();
  app.nodes().find((node) => node.type === "CustomerLookupField" && node.props.type !== "email").props.onChange("Sample"); app.render();
  app.nodes().find((node) => node.type === "TextField" && node.props.type === "tel").props.onChange({ target: { value: "123" } }); app.render();
  const emailField = () => app.nodes().find((node) => node.type === "CustomerLookupField" && node.props.type === "email");
  const disabled = () => app.nodes().find((node) => node.type === "Button" && node.props.children === messages.es.walkInAppointment.saveAction).props.disabled;
  emailField().props.onChange("li"); app.render(); assert.equal(disabled(), true);
  emailField().props.onChange("sample@example.com"); app.render(); assert.equal(disabled(), false);
});
