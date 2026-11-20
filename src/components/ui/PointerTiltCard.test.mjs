import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { usePointerTilt } from "./usePointerTilt.ts";

const require = createRequire(import.meta.url);
const url = new URL("./PointerTiltCard.tsx", import.meta.url);
const loaded = new Module(url.pathname);
const modules = {
  "@/components/ui/Card": { Card: "Card" },
  "@/components/ui/usePointerTilt": { usePointerTilt },
  "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
};
loaded.require = (name) => modules[name] ?? require(name);
loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText, url.pathname);

test("tilt cards share shadows and lift, preserve consumer callbacks and reset on exit", () => {
  let moves = 0, leaves = 0, cancels = 0, clicks = 0;
  const card = loaded.exports.PointerTiltCard({ children: "Content", className: "h-full", onClick() { clicks++; }, onPointerMove() { moves++; }, onPointerLeave() { leaves++; }, onPointerCancel() { cancels++; } });
  assert.equal(card.type, "Card");
  assert.equal(card.props.children, "Content");
  assert.match(card.props.className, /shadow-sm.*hover:shadow-lg/);
  assert.match(card.props.className, /motion-safe:transition-\[transform,box-shadow\]/);
  assert.match(card.props.className, /h-full/);
  const properties = new Map();
  const currentTarget = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }),
    style: { setProperty: (key, value) => properties.set(key, value), removeProperty: (key) => properties.delete(key) }
  };
  const event = { currentTarget, pointerType: "mouse", clientX: 200, clientY: 200 };
  card.props.onPointerMove(event);
  assert.equal(properties.get("--tilt-rotate-x"), "3deg");
  assert.equal(properties.get("--tilt-rotate-y"), "-3deg");
  assert.equal(properties.get("--tilt-lift"), "-4px");
  assert.equal(moves, 1);
  card.props.onPointerLeave(event);
  assert.equal(properties.size, 0);
  assert.equal(leaves, 1);
  card.props.onPointerMove(event);
  card.props.onPointerCancel(event);
  assert.equal(properties.size, 0);
  assert.equal(cancels, 1);
  card.props.onPointerMove({ ...event, pointerType: "touch" });
  assert.equal(properties.size, 0);
  card.props.onClick();
  assert.equal(clicks, 1);
});

test("existing hook consumers keep plain tilt unless they opt into shadow or lift", () => {
  const plain = usePointerTilt();
  assert.doesNotMatch(plain.className, /shadow/);
  assert.match(plain.className, /motion-safe:/);
});

test("home and vertical landing cards share the client tilt primitive while pages retain server price rendering", () => {
  for (const filename of ["PublicLanding", "VerticalLanding"]) {
    const source = readFileSync(new URL(`../../features/landing/components/${filename}.tsx`, import.meta.url), "utf8");
    assert.ok((source.match(/<PointerTiltCard\b/g) ?? []).length >= 5);
    assert.doesNotMatch(source, /landingCardHover|hover:-translate/);
    assert.doesNotMatch(source, /^"use client"/);
  }
});


test("tilt intensity is configurable from zero to one hundred and clamps invalid values", () => {
  for (const [intensity, expected] of [[0, 0], [25, 1.5], [50, 3], [100, 6], [-10, 0], [150, 6], [NaN, 3]]) {
    const properties = new Map();
    const currentTarget = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
      style: { setProperty: (key, value) => properties.set(key, value), removeProperty: (key) => properties.delete(key) }
    };
    const card = loaded.exports.PointerTiltCard({ children: "Content", intensity });
    card.props.onPointerMove({ currentTarget, pointerType: "mouse", clientX: 100, clientY: 100 });
    assert.equal(properties.get("--tilt-rotate-x"), `${expected}deg`);
    assert.equal(properties.get("--tilt-rotate-y"), `${-expected}deg`);
    assert.equal(card.props.intensity, undefined, "animation configuration is not forwarded to the DOM");
  }
});

test("metric cards and personnel use medium tilt while personnel retains its brand border", () => {
  for (const filename of ["DashboardView", "CustomersView", "PaymentsView", "StatisticsView"]) {
    const source = readFileSync(new URL(`../../features/scheduling/components/${filename}.tsx`, import.meta.url), "utf8");
    assert.match(source, /<PointerTiltCard[^>]*intensity=\{50\}/);
  }
  const personnel = readFileSync(new URL("../../features/scheduling/components/PersonnelView/index.tsx", import.meta.url), "utf8");
  assert.match(personnel, /<PointerTiltCard\s+intensity=\{50\}/);
  assert.match(personnel, /hover:border-brand/);
  for (const filename of ["ProfileView", "DashboardActiveTeam"]) {
    const source = readFileSync(new URL(`../../features/scheduling/components/${filename}.tsx`, import.meta.url), "utf8");
    assert.match(source, /usePointerTilt<HTMLButtonElement>\(\{ intensity: 100, shadow: true \}\)/);
  }
});
