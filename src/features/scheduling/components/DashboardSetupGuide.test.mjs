import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { usePointerTilt } from "../../../components/ui/usePointerTilt.ts";
import { messages } from "../i18n/messages.ts";

const require = createRequire(import.meta.url);
const copy = messages.es.setupGuide;

function load(path, modules) {
  const url = new URL(path, import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.require = (name) => modules[name] ?? require(name);
  const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
  });
  loaded._compile(outputText, url.pathname);
  return loaded.exports;
}

function setup(overrides = {}) {
  let dismissed = false;
  let refIndex = 0;
  let effects = [];
  let focused = 0;
  let tree;
  const refs = [];
  const setupCreation = load("./useSetupCreation.ts", { "next/navigation": {} });
  const { DashboardSetupGuide } = load("./DashboardSetupGuide.tsx", {
    "next/link": "Link",
    react: {
      useState: () => [dismissed, (value) => { dismissed = value; }],
      useEffect: (effect) => effects.push(effect),
      useId: () => `top-${refIndex++}`,
      useRef: (value) => refs[refIndex++] ??= { current: value }
    },
    "@/components/ui/Button": { Button: "Button" },
    "@/components/ui/Modal": { Modal: "Modal" },
    "@/components/ui/utils": { cx: (...classes) => classes.join(" ") },
    "@/components/ui/usePointerTilt": { usePointerTilt },
    "@/features/scheduling/components/useSetupCreation": setupCreation,
    "@/features/scheduling/plan-limits": load("../plan-limits.ts", {})
  });
  const props = { copy, employees: [], services: [], subscriptionTier: "free", isReady: true, isCreating: false, ...overrides };

  function nodes(node) {
    if (!node || typeof node !== "object") return [];
    if (node.type === "Modal" && !node.props.isOpen) return [node];
    return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  }

  function find(predicate) { return nodes(tree).find(predicate)?.props; }
  const launcher = () => find((node) => node.props?.["aria-label"] === copy.reopen);
  function render(update) {
    Object.assign(props, update);
    refIndex = 0;
    effects = [];
    tree = DashboardSetupGuide(props);
    const button = launcher();
    if (button) button.ref.current = { focus: () => { focused++; } };
    effects.forEach((effect) => effect());
  }

  render();
  return {
    render, launcher,
    modal: () => find((node) => node.type === "Modal"),
    action: () => find((node) => node.type === "Link"),
    close: () => find((node) => node.props?.["aria-label"] === copy.close),
    hasProgress: (count) => Boolean(find((node) => node.props?.children === copy.progress.replace("{completed}", String(count)))),
    keyDown: (event) => find((node) => node.props?.onKeyDown).onKeyDown(event),
    focusCount: () => focused,
    stepCard: () => find((node) => node.type === "li")
  };
}

const employee = { id: "employee-1", isVisible: true, isArchived: false };
const service = { id: "service-1", isArchived: false };

test("the guide waits for the workspace data and starts with personnel", () => {
  const app = setup({ isReady: false });
  assert.equal(app.modal().isOpen, false);
  assert.equal(app.launcher(), undefined);
  app.render({ isReady: true });
  assert.equal(app.modal().isOpen, true);
  assert.equal(app.action().href, "/personal?setup=create");
  assert.ok(app.hasProgress(0));
});

test("Escape closes the guide, returns focus to the launcher and allows reopening", () => {
  const app = setup();
  const captured = [];
  app.keyDown({ key: "Escape", preventDefault: () => captured.push("default"), stopPropagation: () => captured.push("propagation") });
  assert.deepEqual(captured, ["default", "propagation"]);
  app.render();
  assert.equal(app.modal().isOpen, false);
  assert.equal(app.focusCount(), 1);
  app.launcher().onClick();
  app.render();
  assert.equal(app.modal().isOpen, true);
  app.close().onClick();
  app.render();
  assert.ok(app.launcher());
});

test("businesses with both personnel and services see neither the guide nor the launcher", () => {
  const app = setup({ employees: [employee], services: [service] });
  assert.equal(app.modal().isOpen, false);
  assert.equal(app.launcher(), undefined);
  app.render({ employees: [{ ...employee, isVisible: false }] });
  assert.equal(app.modal().isOpen, false);
  assert.equal(app.launcher(), undefined);
});

test("the launcher resumes at service after personnel creation and disappears after both steps", () => {
  const app = setup();
  app.action().onNavigate();
  app.render({ isCreating: true });
  assert.equal(app.modal().isOpen, false);
  assert.equal(app.launcher(), undefined);
  app.render({ isCreating: false, employees: [employee] });
  app.launcher().onClick();
  app.render();
  assert.ok(app.hasProgress(1));
  assert.equal(app.action().href, "/servicios?setup=create");
  app.render({ services: [service] });
  assert.equal(app.modal().isOpen, false);
  assert.equal(app.launcher(), undefined);
});

test("only archived records count as missing and hidden personnel leads to the team list", () => {
  const app = setup({ employees: [{ ...employee, isArchived: true }], services: [{ ...service, isArchived: true }] });
  assert.equal(app.action().href, "/personal?setup=create");
  assert.ok(app.hasProgress(0));
  app.render({ employees: [{ ...employee, isVisible: false }] });
  assert.equal(app.action().href, "/personal");
  assert.equal(app.action().children[0], copy.managePersonnel);
  app.render({ employees: [], services: [service] });
  assert.ok(app.hasProgress(1));
  assert.equal(app.action().href, "/personal?setup=create");
});

test("finishing or canceling a direct creation link removes only the setup query", () => {
  const replacements = [];
  let query = "setup=create&search=Andrea";
  const { useSetupCreation } = load("./useSetupCreation.ts", {
    "next/navigation": {
      usePathname: () => "/personal",
      useRouter: () => ({ replace: (...args) => replacements.push(args) }),
      useSearchParams: () => new URLSearchParams(query)
    }
  });

  const creation = useSetupCreation();
  assert.equal(creation.startsInCreateMode, true);
  creation.leaveSetupCreation();
  assert.deepEqual(replacements, [["/personal?search=Andrea", { scroll: false }]]);

  query = "search=Andrea";
  const regular = useSetupCreation();
  assert.equal(regular.startsInCreateMode, false);
  regular.leaveSetupCreation();
  assert.equal(replacements.length, 1);
});

test("step cards tilt toward the mouse and reset on leaving or canceling without reacting to touch", () => {
  const card = setup().stepCard();
  const properties = new Map();
  const currentTarget = {
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 }),
    style: {
      setProperty: (key, value) => properties.set(key, value),
      removeProperty: (key) => properties.delete(key)
    }
  };
  card.onPointerMove({ pointerType: "touch", currentTarget, clientX: 210, clientY: 120 });
  assert.equal(properties.size, 0);
  card.onPointerMove({ pointerType: "mouse", currentTarget, clientX: 210, clientY: 120 });
  assert.equal(properties.get("--tilt-rotate-x"), "3deg");
  assert.equal(properties.get("--tilt-rotate-y"), "-3deg");
  card.onPointerLeave({ currentTarget });
  assert.equal(properties.size, 0);
  card.onPointerMove({ pointerType: "mouse", currentTarget, clientX: 10, clientY: 20 });
  assert.equal(properties.get("--tilt-rotate-y"), "3deg");
  card.onPointerCancel({ currentTarget });
  assert.equal(properties.size, 0);
});
