import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MiTurnoListo",
    short_name: "MiTurnoListo",
    description: "Agenda online, turnos, servicios, personal y pagos para negocios de servicios.",
    start_url: "/",
    display: "standalone",
    icons: [
      {
        src: "/branding/favicon-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/branding/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  };
}
