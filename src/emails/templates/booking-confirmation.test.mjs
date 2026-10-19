import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import ts from "typescript";

import { formatCancellationPolicy } from "../../features/scheduling/service-cancellation-policy.ts";
import { messages } from "../../features/scheduling/i18n/messages.ts";

const require = createRequire(import.meta.url);

function loadTemplate(path, dependencies = {}) {
  const fileUrl = new URL(path, import.meta.url);
  const output = ts.transpileModule(readFileSync(fileUrl, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const templateModule = new Module(fileUrl.pathname);
  templateModule.filename = fileUrl.pathname;
  templateModule.require = (specifier) => dependencies[specifier] ?? require(specifier);
  templateModule._compile(output, fileUrl.pathname);
  return templateModule.exports;
}

const shared = loadTemplate("./shared.ts");
const { bookingConfirmationEmail } = loadTemplate("./booking-confirmation.ts", {
  "@/emails/templates/shared": shared
});

const booking = {
  appointmentDate: "21 de octubre de 2026",
  appointmentTime: "12:00",
  businessName: "Negocio de prueba",
  customerName: "Cliente de prueba",
  manageBookingUrl: "https://example.com/cancelar-turno/token",
  serviceName: "Servicio de prueba"
};

test("booking email links to cancellation and explains a zero-hour deadline", () => {
  const html = bookingConfirmationEmail({
    ...booking,
    cancellationPolicyText: formatCancellationPolicy(0, messages.es)
  });

  assert.match(html, /Ver o cancelar turno/);
  assert.match(html, /Podés cancelar hasta el inicio del turno\./);
  assert.match(html, /https:\/\/example\.com\/cancelar-turno\/token/);
  assert.doesNotMatch(html, /reprogramar/i);
});

test("booking email shows the selected hourly cancellation deadline", () => {
  const html = bookingConfirmationEmail({
    ...booking,
    cancellationPolicyText: formatCancellationPolicy(120, messages.es)
  });

  assert.match(html, /Podés cancelar hasta 2 horas antes del turno\./);
});
