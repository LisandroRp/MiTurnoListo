import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { messages } from "../../scheduling/i18n/messages.ts";

const require = createRequire(import.meta.url);
function loadComponent(relativePath, modules = {}) {
  const url = new URL(relativePath, import.meta.url);
  const loaded = new Module(url.pathname);
  loaded.filename = url.pathname;
  loaded.require = (name) => modules[name] ?? require(name);
  loaded._compile(ts.transpileModule(readFileSync(url, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, url.pathname);
  return loaded.exports;
}

const formattedText = loadComponent("../../../components/ui/FormattedText.tsx", {
  "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") }
});
const businessDetails = loadComponent("./PublicBusinessDetails.tsx", { "@/components/ui/FormattedText": formattedText, "next/link": { default: ({ children, ...props }) => createElement("a", props, children) } });
const businessHeader = loadComponent("./PublicBusinessHeader.tsx", {
  "@/features/booking-flow/components/PublicBusinessDetails": businessDetails,
  "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
  "@/components/composed/BrandMark": { BrandMark: () => null }
});

function render(publicDescription, publicLogoUrl = "") {
  let cursor = 0;
  const payload = { publicDescription, publicLogoUrl, businessName: "Clinic", address: "Example address", publicOpeningHours: "9 to 18", services: [], theme: "blue" };
  const modules = {
    "@/features/booking-flow/components/PublicBusinessHeader": businessHeader,
    react: { ...require("react"), useEffect: () => {}, useState: (initial) => [cursor++ === 0 ? payload : cursor === 2 ? false : initial, () => {}] },
    "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
    "@/components/composed/BrandMark": { BrandMark: () => null },
    "@/components/ui/FormattedText": formattedText,
    "@/components/ui/Card": { Card: ({ children }) => createElement("section", null, children) },
    "@/components/ui/TextField": { TextField: () => null },
    "@/components/ui/SelectField": { SelectField: () => null },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
    "@/features/scheduling/i18n/messages": { messages },
    "@/features/booking-flow/utils/catalog": {},
    "@/features/scheduling/utils/format": {},
    "@/lib/networking/endpoints/public-services": {},
    "@/lib/networking/response-errors": {}
  };
  return renderToStaticMarkup(createElement(loadComponent("./PublicServicesCatalog.tsx", modules).PublicServicesCatalog, { businessId: "business" }));
}

test("public catalog shows the business description before address and hours with line breaks", () => {
  for (const logo of ["", "https://example.com/logo.webp"]) {
    const html = render("Atención particular.\nConsultá por obra social.", logo);
    assert.match(html, /whitespace-pre-line[^>]*>Atención particular\.\nConsultá por obra social\.<\/p>/);
    assert.ok(html.indexOf("Atención particular.") < html.indexOf("Example address"));
    assert.ok(html.indexOf("Example address") < html.indexOf("9 to 18"));
  }
});

test("empty public descriptions leave no description paragraph and content is escaped", () => {
  for (const description of ["", "   ", undefined]) assert.doesNotMatch(render(description), /<p className="whitespace-pre-line"/);
  assert.match(render("<script>alert(1)</script>"), /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("booking and catalog share compact business details with description first", () => {
  const bookingSource = readFileSync(new URL("./BookingFlow/index.tsx", import.meta.url), "utf8");
  assert.match(bookingSource, /<PublicBusinessHeader[\s\S]*description=\{publicHeader.publicDescription\}[\s\S]*openingHours=\{publicHeader.publicOpeningHours\}/);
  for (const logoUrl of [undefined, "https://example.com/logo.webp"]) {
    const html = renderToStaticMarkup(createElement(businessDetails.PublicBusinessDetails, {
      businessName: "Clinic", description: "First line\nSecond line", address: "Address", openingHours: "Hours", logoUrl
    }));
    assert.ok(html.indexOf("First line") < html.indexOf("Address"));
    assert.ok(html.indexOf("Address") < html.indexOf("Hours"));
    assert.match(html, /mt-2 grid gap-1 text-xs leading-5 text-muted/);
    assert.match(html, /text-sm leading-6 text-muted/);
    if (!logoUrl) assert.match(html, /<h1[^>]*>Clinic<\/h1>/);
  }
});

test("business details omit empty metadata and provide an accessible logo", () => {
  const html = renderToStaticMarkup(createElement(businessDetails.PublicBusinessDetails, {
    businessName: "Clinic", logoUrl: "https://example.com/logo.webp", address: " ", openingHours: "", description: " "
  }));
  assert.match(html, /<img[^>]*src="https:\/\/example.com\/logo.webp"[^>]*alt="Clinic"/);
  assert.doesNotMatch(html, /<h1|<p|<span|mt-2 grid/);
});


test("public catalog renders saved bold, underline and bullet lists", () => {
  const html = render("**Welcome**\n- __Arrive early__");
  assert.match(html, /class="space-y-1 break-words text-center mx-auto (?:mt-3 )?w-full max-w-3xl text-sm leading-6 text-muted"/);
  assert.match(html, /<strong>Welcome<\/strong>/);
  assert.match(html, /<li><span class="underline">Arrive early<\/span><\/li>/);
});

test("online booking centers its description and markers and separates the header from the steps", () => {
  const bookingSource = readFileSync(new URL("./BookingFlow/index.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(bookingSource, /Reserva online|descriptionAlign=/);
  assert.match(bookingSource, /<header className="grid gap-8">/);
  const html = renderToStaticMarkup(createElement(businessDetails.PublicBusinessDetails, {
    businessName: "Clinic", description: "Welcome\n- First\n- Second"
  }));
  assert.match(html, /space-y-1 break-words text-center/);
  assert.match(html, /list-disc space-y-1 list-inside/);
});


test("catalog and booking use the identical public header without a booking eyebrow", () => {
  for (const path of ["./PublicServicesCatalog.tsx", "./BookingFlow/index.tsx"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /<PublicBusinessHeader/);
  }
  const html = renderToStaticMarkup(createElement(businessHeader.PublicBusinessHeader, {
    businessName: "Clinic", description: "Description", address: "Address", openingHours: "Hours"
  }));
  assert.doesNotMatch(html, /Reserva online/);
  assert.match(html, /text-center/);
});

test("public logos use intrinsic proportions with responsive bounds instead of a square frame", () => {
  const html = renderToStaticMarkup(createElement(businessDetails.PublicBusinessDetails, {
    businessName: "Clinic", logoUrl: "https://example.com/logo.webp"
  }));
  assert.match(html, /h-auto max-h-36 w-auto max-w-full object-contain sm:max-h-44/);
  assert.doesNotMatch(html, /background-image|w-32|w-36|width=|height=/);
});

function interactiveCatalog() {
  const services = [
    { id: "one", name: "Cut", description: "Hair", employeeNames: ["Alex"] },
    { id: "two", name: "Color", description: "Hair", employeeNames: ["Bea"] },
    { id: "three", name: "Cut long", description: "Hair", employeeNames: ["Bea", "Alex"] }
  ];
  const states = [];
  let cursor = 0;
  const react = {
    ...require("react"), useEffect: () => {}, useId: () => "service-details",
    useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = index === 0 ? { services, theme: "blue" } : index === 1 ? false : initial;
      return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    }
  };
  const modules = {
    react,
    "next/link": { default: "a" },
    "@/features/booking-flow/components/PublicBusinessHeader": { PublicBusinessHeader: () => null },
    "@/components/composed/BrandMark": { BrandMark: () => null },
    "@/components/ui/FormattedText": formattedText,
    "@/components/ui/Card": { Card: "section" },
    "@/components/ui/TextField": { TextField: "search" },
    "@/components/ui/SelectField": { SelectField: "select" },
    "@/components/ui/utils": { cx: (...values) => values.filter(Boolean).join(" ") },
    "@/features/scheduling/i18n/messages": { messages },
    "@/features/booking-flow/utils/catalog": { getCatalogDescription: (value) => value, getProfessionalLabel: () => "Professional", getServiceTitleOverflowClass: () => "" },
    "@/features/scheduling/utils/format": { formatCurrency: (value) => `$${value}` },
    "@/lib/networking/endpoints/public-services": {},
    "@/lib/networking/response-errors": {}
  };
  const components = loadComponent("./PublicServicesCatalog.tsx", modules);
  const renderCatalog = () => { cursor = 0; return components.PublicServicesCatalog({ businessId: "business" }); };
  const renderCard = (service) => { cursor = 10 + Math.max(0, services.findIndex((item) => item.id === service.id)); return components.PublicServiceCard({ service, messages: messages.es, businessSlug: "business" }); };
  const nodes = (node) => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).filter(Boolean).flatMap(nodes)];
  return { renderCatalog, renderCard, nodes, services };
}

test("professional filter combines with text search and can be reset", () => {
  const app = interactiveCatalog();
  let tree = app.renderCatalog();
  const select = app.nodes(tree).find((node) => node.type === "select");
  assert.deepEqual(select.props.options.map((option) => option.value), ["", "Alex", "Bea"]);
  select.props.onChange({ target: { value: "Bea" } });
  tree = app.renderCatalog();
  const cards = () => app.nodes(tree).filter((node) => node.type?.name === "PublicServiceCard").map((node) => node.props.service.id);
  assert.deepEqual(cards(), ["two", "three"]);
  app.nodes(tree).find((node) => node.type === "search").props.onChange({ target: { value: "CUT" } });
  tree = app.renderCatalog();
  assert.deepEqual(cards(), ["three"]);
  app.nodes(tree).find((node) => node.type === "select").props.onChange({ target: { value: "" } });
  tree = app.renderCatalog();
  assert.deepEqual(cards(), ["one", "three"]);
  app.nodes(tree).find((node) => node.type === "search").props.onChange({ target: { value: "Unknown" } });
  tree = app.renderCatalog();
  assert.equal(cards().length, 0);
  assert.ok(app.nodes(tree).some((node) => node.props?.title === messages.es.publicServices.noSearchResultsTitle));
});


test("description controls appear beside the title only for nonempty descriptions", () => {
  const app = interactiveCatalog();
  for (const description of ["", "   ", "\n"]) {
    const tree = app.renderCard({ ...app.services[0], description, price: 123, durationMinutes: 30, capacity: 1 });
    assert.equal(app.nodes(tree).some((node) => node.type === "button"), false);
  }
  const service = { ...app.services[0], price: 123, durationMinutes: 30, capacity: 1 };
  let tree = app.renderCard(service);
  let nodes = app.nodes(tree);
  let toggle = nodes.find((node) => node.type === "button");
  assert.equal(toggle.props["aria-expanded"], false);
  assert.doesNotMatch(toggle.props.className, /absolute|md:hidden/);
  assert.ok(nodes.some((node) => /flex items-(start|center) justify-between gap-3/.test(node.props?.className ?? "")));
  const descriptionRegion = () => nodes.find((node) => node.props?.id === toggle.props["aria-controls"]);
  assert.equal(descriptionRegion().props.inert, true);
  toggle.props.onClick();
  tree = app.renderCard(service);
  nodes = app.nodes(tree);
  toggle = nodes.find((node) => node.type === "button");
  assert.equal(toggle.props["aria-expanded"], true);
  assert.equal(descriptionRegion().props.inert, false);
  assert.match(descriptionRegion().props.className, /duration-300/);
  const other = app.renderCard({ ...app.services[1], price: 123, durationMinutes: 30, capacity: 1 });
  assert.equal(app.nodes(other).find((node) => node.type === "button").props["aria-expanded"], false);
  toggle.props.onClick();
  assert.equal(app.nodes(app.renderCard(service)).find((node) => node.type === "button").props["aria-expanded"], false);
  const professionals = nodes.find((node) => node.type?.name === "EmployeeFact");
  assert.deepEqual(professionals.props.names, ["Alex"]);
  const booking = nodes.find((node) => node.props?.["aria-label"] === "Sacar turno: Cut");
  assert.ok(booking);
  assert.match(booking.props.className, /!text-white/);
  const catalog = readFileSync(new URL("./PublicServicesCatalog.tsx", import.meta.url), "utf8");
  assert.match(catalog, /grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3/);
});

test("public business logo links to its catalog in booking and catalog headers", () => {
  const html = renderToStaticMarkup(createElement(businessDetails.PublicBusinessDetails, {
    businessName: "Clinic", logoUrl: "https://example.com/logo.webp", catalogHref: "/clinic"
  }));
  assert.match(html, /<a href="\/clinic"[^>]*>[\s\S]*<img/);
  for (const [path, expected] of [["./PublicServicesCatalog.tsx", /catalogHref=\{`\/\$\{businessSlug\}`\}/], ["./BookingFlow/index.tsx", /catalogHref=\{businessKey \? `\/\$\{businessKey\}` : undefined\}/]]) {
    assert.match(readFileSync(new URL(path, import.meta.url), "utf8"), expected);
  }
});


test("expanded catalog description uses the shared formatted text renderer", () => {
  const app = interactiveCatalog();
  const tree = app.renderCard({ ...app.services[0], description: "**Welcome**\n- __Item__", price: 123, durationMinutes: 30, capacity: 1 });
  const node = app.nodes(tree).find((node) => node.type === formattedText.FormattedText);
  assert.ok(node);
  const html = renderToStaticMarkup(createElement(node.type, node.props));
  assert.match(html, /<strong>Welcome<\/strong>/);
  assert.match(html, /<li><span class="underline">Item<\/span><\/li>/);
});
