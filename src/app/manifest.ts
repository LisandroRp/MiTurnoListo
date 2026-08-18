import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MiTurnoListo",
    short_name: "MiTurnoListo",
    description: "Agenda virtual y organizador de turnos online para negocios de servicios.",
    start_url: "/",
    display: "standalone",
    icons: [
      {
        src: "/branding/favicon-48x48.png",
        sizes: "48x48",
        type: "image/png"
      },
      {
        src: "/branding/favicon-192x192.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/branding/favicon-512x512.png",
        sizes: "512x512",
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
