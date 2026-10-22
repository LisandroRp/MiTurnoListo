export type MessageTemplate = { id: string; title: string; body: string };

export const messageTemplateVariables = ["negocio", "link", "servicio"] as const;

export function renderMessageTemplate(body: string, values: { negocio: string; link: string; servicio: string }) {
  return body.replace(/\{\{(negocio|link|servicio)\}\}/g, (_, key: keyof typeof values) => values[key]);
}

export function isValidMessageTemplate(title: string, body: string) {
  return title.trim().length >= 1 && title.trim().length <= 80 && body.trim().length >= 1 && body.trim().length <= 3000;
}

export function getStarterMessageTemplates(locale: "es" | "en"): MessageTemplate[] {
  return locale === "es" ? [
    { id: "welcome", title: "Bienvenida", body: "¡Hola! 👋 Bienvenido a *{{negocio}}*.\n\nPodés consultar nuestros servicios y reservar tu turno acá:\n{{link}}\n\n¡Te esperamos!" },
    { id: "booking", title: "Invitación a reservar", body: "¡Hola! 😊 ¿Querés reservar un turno en *{{negocio}}*?\n\nElegí el día y horario que más te convenga:\n{{link}}" },
    { id: "catalog", title: "Compartir catálogo", body: "¡Conocé los servicios de *{{negocio}}*! ✨\n\nConsultá las opciones y reservá online:\n{{link}}" },
    { id: "service", title: "Promocionar un servicio", body: "En *{{negocio}}* te esperamos para *{{servicio}}*. 🙌\n\nConsultá los horarios disponibles y reservá acá:\n{{link}}" }
  ] : [
    { id: "welcome", title: "Welcome", body: "Hi! 👋 Welcome to *{{negocio}}*.\n\nBrowse our services and book here:\n{{link}}\n\nSee you soon!" },
    { id: "booking", title: "Invite to book", body: "Hi! 😊 Ready to book at *{{negocio}}*?\n\nChoose the date and time that work for you:\n{{link}}" },
    { id: "catalog", title: "Share catalog", body: "Discover the services at *{{negocio}}*! ✨\n\nBrowse our options and book online:\n{{link}}" },
    { id: "service", title: "Promote a service", body: "Visit *{{negocio}}* for *{{servicio}}*. 🙌\n\nCheck availability and book here:\n{{link}}" }
  ];
}
