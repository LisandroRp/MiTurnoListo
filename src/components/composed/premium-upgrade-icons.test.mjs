import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { FaInfinity } from "react-icons/fa";
import { FiLock } from "react-icons/fi";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(name) {
  const url = new URL(`./${name}.tsx`, import.meta.url);
  const loaded = new Module(url.pathname);
  const modules = {
    "react-icons/fa": { FaInfinity },
    "react-icons/fi": { ...require("react-icons/fi"), FiLock },
    "next/link": { default: "Link" },
    "@/components/ui/Badge": { Badge: "Badge" },
    "@/components/ui/Button": { Button: "Button" },
    "@/components/ui/Card": { Card: "Card" },
    "@/components/ui/Modal": { Modal: "Modal" }
  };
  loaded.require = (specifier) => modules[specifier] ?? require(specifier);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
  }).outputText, url.pathname);
  return loaded.exports[name];
}
const nodes = (node) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).filter(Boolean).flatMap(nodes)];

for (const name of ["PremiumFeatureCard", "PlanLimitModal"]) {
  test(`${name} uses the Infinity symbol and preserves the plan link and modal closing behavior`, () => {
    let closes = 0;
    const Component = load(name);
    const tree = Component({ title: "Upgrade", badge: "Plan INFINITY", description: "More visible resources", actionLabel: "Ver INFINITY", isOpen: true, onClose: () => { closes += 1; } });
    const all = nodes(tree);
    const icons = all.filter((node) => node.type === FaInfinity);
    assert.equal(icons.length, 1);
    assert.equal(icons[0].props["aria-hidden"], "true");
    assert.equal(all.some((node) => node.type === FiLock), false);
    const link = all.find((node) => node.type === "Link");
    assert.equal(link.props.href, "/perfil#planes");
    assert.equal(link.props.children, "Ver INFINITY");
    if (name === "PlanLimitModal") {
      assert.equal(tree.props.isOpen, true);
      all.find((node) => node.type === "Button").props.onClick();
      link.props.onClick();
      assert.equal(closes, 2);
    }
  });
}
