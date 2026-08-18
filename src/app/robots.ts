import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.miturnolisto.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/catalogo/", "/reservar/"],
        disallow: [
          "/inicio",
          "/calendario",
          "/servicios",
          "/personal",
          "/clientes",
          "/pagos",
          "/estadisticas",
          "/perfil",
          "/metodos-de-pago",
          "/nueva-reserva",
          "/api/"
        ]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
