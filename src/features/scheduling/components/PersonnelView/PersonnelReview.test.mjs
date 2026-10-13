import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadComponent(fileName, dependencies) {
  const fileUrl = new URL(fileName, import.meta.url);
  const source = readFileSync(fileUrl, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: fileUrl.pathname
  }).outputText;
  const componentModule = new Module(fileUrl.pathname);
  componentModule.filename = fileUrl.pathname;
  componentModule.require = (specifier) => dependencies[specifier] ?? require(specifier);
  componentModule._compile(output, fileUrl.pathname);
  return componentModule.exports;
}

const { EmployeeAvatar } = loadComponent("./EmployeeAvatar.tsx", {
  "@/components/ui/utils": { cx: (...classes) => classes.filter(Boolean).join(" ") },
  "@/features/scheduling/components/employeeColors": {
    employeeColorClasses: { "employee-coral": "bg-employee-coral" }
  }
});
const { PersonnelReview } = loadComponent("./PersonnelReview.tsx", {
  "@/features/scheduling/components/AvailabilityEditor": { dayKeys: ["monday"] },
  "./EmployeeAvatar": { EmployeeAvatar },
  "./FormSection": { FormSection: ({ children }) => createElement("section", null, children) },
  "./personnelViewUtils": { getScheduleRangeCount: () => 0 }
});

const messages = {
  days: { monday: "Monday" },
  personnel: {
    emptyDescription: "No description",
    emptyRole: "No role",
    emptySchedule: "No schedule",
    ranges: "ranges",
    reviewSection: "Review",
    reviewSectionHint: "Check the employee",
    schedule: "Availability",
    untitledEmployee: "Unnamed employee"
  }
};
const employee = {
  color: "employee-coral",
  description: "",
  imageUrl: "",
  initials: "C",
  name: "Carla",
  role: "Stylist",
  schedule: { monday: [] }
};

test("personnel review shows one large circular initial when there is no photo", () => {
  const html = renderToStaticMarkup(createElement(PersonnelReview, { employee, messages }));

  assert.match(html, /<span class="[^"]*h-24 w-24[^"]*bg-employee-coral[^"]*">C<\/span>/);
  assert.equal(html.match(/rounded-full/g)?.length, 1);
  assert.doesNotMatch(html, /min-h-56|bg-contain|background-image/);
});

test("personnel review shows the selected photo inside the same circle", () => {
  const html = renderToStaticMarkup(createElement(PersonnelReview, {
    employee: { ...employee, imageUrl: "data:image/png;base64,AAAA" },
    messages
  }));

  assert.match(html, /<span class="[^"]*h-24 w-24[^"]*bg-cover[^"]*" style="background-image:url\(data:image\/png;base64,AAAA\)"><\/span>/);
  assert.equal(html.match(/rounded-full/g)?.length, 1);
  assert.doesNotMatch(html, /bg-employee-coral|min-h-56/);
});
