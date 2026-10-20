import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function findLine(source, fragment) {
  const line = source.split("\n").find((candidate) => candidate.includes(fragment));

  assert.ok(line, `Expected to find source line containing: ${fragment}`);
  return line;
}

function getNumericZIndex(sourceLine) {
  const match = sourceLine.match(/\bz-(\d+)\b/);

  assert.ok(match, `Expected a numeric z-index utility in: ${sourceLine}`);
  return Number(match[1]);
}

test("mobile drawer stays above the dashboard agenda header", () => {
  const appShell = readFileSync(new URL("./AppShell.tsx", import.meta.url), "utf8");
  const dashboardView = readFileSync(new URL("./DashboardView.tsx", import.meta.url), "utf8");
  const drawerLayer = findLine(appShell, "fixed inset-0");
  const agendaHeaderLayer = findLine(dashboardView, "sticky top-0");

  assert.ok(getNumericZIndex(drawerLayer) > getNumericZIndex(agendaHeaderLayer));
});
