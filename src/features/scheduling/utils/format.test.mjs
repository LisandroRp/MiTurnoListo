import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatServiceDuration } from "./format.ts";
import { messages } from "../i18n/messages.ts";

test("service durations show hours and remaining minutes with correct singular and plural", () => {
  for (const [value, es, en] of [[0, "0 minutos", "0 minutes"], [1, "1 minuto", "1 minute"], [45, "45 minutos", "45 minutes"], [60, "1 hora", "1 hour"], [61, "1 hora 1 minuto", "1 hour 1 minute"], [90, "1 hora 30 minutos", "1 hour 30 minutes"], [120, "2 horas", "2 hours"], [150, "2 horas 30 minutos", "2 hours 30 minutes"], [300, "5 horas", "5 hours"]]) {
    assert.equal(formatServiceDuration(value, messages.es.services), es);
    assert.equal(formatServiceDuration(value, messages.en.services), en);
  }
});

test("table and public duration displays use the formatter while service input and review retain minutes", () => {
  for (const file of ["../../booking-flow/components/PublicServicesCatalog.tsx", "../../booking-flow/components/BookingFlow/steps/ServiceStep.tsx", "../../booking-flow/components/BookingFlow/layout/BookingSidebar.tsx", "../../../app/(dashboard)/nueva-reserva/page.tsx", "../components/ServicesView.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /formatServiceDuration\(service.durationMinutes, messages.services\)/);
  }
  const editor = readFileSync(new URL("../components/ServicesView.tsx", import.meta.url), "utf8");
  assert.match(editor, /label=\{messages.services.durationMinutesLabel\}/);
  assert.match(editor, /value=\{formatNumericInputValue\(draft.durationMinutes\)\}/);
  assert.match(editor, /value=\{`\$\{service.durationMinutes\} \$\{messages.services.minutes\}`\}/);
});
