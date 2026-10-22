import assert from "node:assert/strict";
import test from "node:test";
import { getStarterMessageTemplates, isValidMessageTemplate, renderMessageTemplate } from "./message-templates.ts";

test("starter templates in both languages replace supported business variables", () => {
  for (const locale of ["es", "en"]) {
    const templates = getStarterMessageTemplates(locale);
    assert.equal(templates.length, 4);
    assert.equal(new Set(templates.map((template) => template.id)).size, 4);
    for (const template of templates) {
      assert.equal(isValidMessageTemplate(template.title, template.body), true);
      const rendered = renderMessageTemplate(template.body, { negocio: "Clínica $&", servicio: "Consulta", link: "https://example.com/clinica" });
      assert.match(rendered, /Clínica \$&/);
      assert.match(rendered, /https:\/\/example.com\/clinica/);
      assert.doesNotMatch(rendered, /\{\{(negocio|link|servicio)\}\}/);
    }
  }
});

test("rendering preserves user text, line breaks and unknown placeholders", () => {
  assert.equal(renderMessageTemplate("{{negocio}}\n{{link}} {{servicio}} {{other}} <script>", { negocio: "A", link: "B", servicio: "C" }), "A\nB C {{other}} <script>");
});

test("template validation rejects blank and oversized content", () => {
  for (const [title, body] of [[" ", "body"], ["name", "\n"], ["a".repeat(81), "body"], ["name", "a".repeat(3001)]]) {
    assert.equal(isValidMessageTemplate(title, body), false);
  }
  assert.equal(isValidMessageTemplate("a".repeat(80), "a".repeat(3000)), true);
});
