import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { messages } from "../../i18n/messages.ts";
import ts from "typescript";

const require = createRequire(import.meta.url);
const url = new URL("./StatisticsPanel.tsx", import.meta.url);
const loaded = new Module(url.pathname);
const mocks = {
  "@/components/composed/PremiumFeatureCard": { PremiumFeatureCard: "PremiumFeatureCard" },
  "@/components/ui/Card": { Card: "Card" },
  "@/features/scheduling/components/StatisticsView/AnalyticsPanel": { AnalyticsPanel: "AnalyticsPanel" }
};
loaded.require = (name) => mocks[name] ?? require(name);
loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, url.pathname);
const { StatisticsPanel } = loaded.exports;
const props = { title: "Employee analysis", description: "Compare employee performance.", controls: messages.es.statistics };

test("locked statistics never evaluate real report content or mount expansion controls", () => {
  let rendered = 0;
  const node = StatisticsPanel({ ...props, isLocked: true, children: () => { rendered += 1; throw new Error("Restricted report evaluated"); } });
  assert.equal(rendered, 0);
  assert.equal(node.props.children[0].props["aria-hidden"], "true");
  const lock = node.props.children[1].props.children;
  assert.equal(lock.type, "PremiumFeatureCard");
  assert.equal(lock.props.actionLabel, messages.es.statistics.advancedLockedAction);
  assert.equal(lock.props.title, props.title);
  assert.equal(JSON.stringify(node).includes("Restricted report"), false);
});

test("unlocked statistics preserve the existing animated panel and static detail behavior", () => {
  const children = (expanded) => expanded ? "expanded report" : "report";
  const panel = StatisticsPanel({ ...props, isLocked: false, children });
  assert.equal(panel.type, "AnalyticsPanel");
  assert.equal(panel.props.children, children);
  const detail = StatisticsPanel({ ...props, isLocked: false, expandable: false, children });
  assert.equal(detail.props.children, "report");
});
