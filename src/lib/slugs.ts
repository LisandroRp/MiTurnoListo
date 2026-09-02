export function normalizeSlug(value: string, fallback = "item") {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return slug || fallback;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const reservedPublicSlugs = new Set([
  "admin",
  "api",
  "calendario",
  "cancelar-turno",
  "catalogo",
  "clientes",
  "estadisticas",
  "favicon-ico",
  "inicio",
  "login",
  "manifest-webmanifest",
  "metodos-de-pago",
  "nueva-reserva",
  "pagos",
  "perfil",
  "personal",
  "reservar",
  "robots-txt",
  "servicios",
  "sitemap-xml"
]);

export function isReservedPublicSlug(slug: string) {
  return reservedPublicSlugs.has(normalizeSlug(slug, ""));
}

export function getSafePublicSlug(value: string, fallback = "negocio") {
  const slug = normalizeSlug(value, fallback);

  return isReservedPublicSlug(slug) ? `${slug}-${fallback}` : slug;
}
