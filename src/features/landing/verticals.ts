export type VerticalLandingKey = "barberias" | "peluquerias" | "estetica";

export type VerticalLandingConfig = {
  key: VerticalLandingKey;
  path: `/${string}`;
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  services: readonly string[];
  professionals: readonly string[];
  seo: {
    title: string;
    description: string;
    canonical: string;
  };
  og: {
    title: string;
    subtitle: string;
  };
  faq: readonly {
    question: string;
    answer: string;
  }[];
};

const sharedFaq = [
  {
    question: "¿Necesito instalar una aplicación?",
    answer: "No. MiTurnoListo funciona desde el navegador, así que podés configurar tu agenda y compartir tu link sin instalar una app."
  },
  {
    question: "¿Mis clientes necesitan crear una cuenta?",
    answer: "No. Tus clientes pueden reservar desde tu link público sin crear una cuenta en MiTurnoListo."
  },
  {
    question: "¿Puedo compartir mi página de reservas por WhatsApp o Instagram?",
    answer: "Sí. Podés compartir tu link de reservas por WhatsApp, Instagram o cualquier canal donde atiendas consultas."
  },
  {
    question: "¿Puedo configurar distintos horarios para cada persona de mi equipo?",
    answer: "Sí. Podés cargar personal, servicios y disponibilidad para organizar quién atiende cada turno."
  },
  {
    question: "¿Puedo empezar gratis?",
    answer: "Sí. El plan gratis te permite empezar con servicios visibles, personal y turnos mensuales limitados."
  }
] as const;

export const verticalLandingConfigs = {
  barberias: {
    key: "barberias",
    path: "/barberias",
    eyebrow: "Turnos online para barberías",
    heroTitle: "Que tus clientes reserven sin mandarte un WhatsApp.",
    heroDescription: "Configurá tus servicios, personal y horarios. Compartí tu link y dejá que tus clientes elijan cuándo quieren atenderse.",
    services: ["Corte", "Corte + barba", "Barba", "Perfilado"],
    professionals: ["Martín", "Lucas", "Nico"],
    seo: {
      title: "Sistema de turnos para barberías | MiTurnoListo",
      description: "Turnos online para barberías. Organizá servicios, personal y horarios y permití que tus clientes reserven desde un link.",
      canonical: "https://www.miturnolisto.com/barberias"
    },
    og: {
      title: "Turnos online para barberías",
      subtitle: "Tus clientes reservan solos."
    },
    faq: sharedFaq
  },
  peluquerias: {
    key: "peluquerias",
    path: "/peluquerias",
    eyebrow: "Turnos online para peluquerías",
    heroTitle: "Tus clientes reservan solos. Vos ocupate de tu peluquería.",
    heroDescription: "Organizá servicios, personal y horarios desde un solo lugar. Compartí tu link y recibí reservas online las 24 horas.",
    services: ["Corte", "Color", "Brushing", "Nutrición", "Balayage"],
    professionals: ["Sofía", "Valentina", "Camila"],
    seo: {
      title: "Sistema de turnos para peluquerías | MiTurnoListo",
      description: "Agenda y turnos online para peluquerías. Organizá servicios, personal y horarios y recibí reservas desde tu propio link.",
      canonical: "https://www.miturnolisto.com/peluquerias"
    },
    og: {
      title: "Turnos online para peluquerías",
      subtitle: "Menos WhatsApp. Más organización."
    },
    faq: sharedFaq
  },
  estetica: {
    key: "estetica",
    path: "/estetica",
    eyebrow: "Turnos online para centros de estética",
    heroTitle: "Menos mensajes. Más turnos organizados.",
    heroDescription: "Permití que tus clientes elijan tratamiento, profesional, día y horario desde tu propio link de reservas.",
    services: ["Limpieza facial", "Manicuría", "Depilación", "Masajes", "Tratamientos corporales"],
    professionals: ["Florencia", "Paula", "Marina"],
    seo: {
      title: "Sistema de turnos para centros de estética | MiTurnoListo",
      description: "Turnos online para centros de estética. Gestioná tratamientos, personal y horarios y recibí reservas online las 24 horas.",
      canonical: "https://www.miturnolisto.com/estetica"
    },
    og: {
      title: "Turnos online para centros de estética",
      subtitle: "Tus clientes reservan 24/7."
    },
    faq: sharedFaq
  }
} satisfies Record<VerticalLandingKey, VerticalLandingConfig>;

export const verticalLandingList = [
  verticalLandingConfigs.barberias,
  verticalLandingConfigs.peluquerias,
  verticalLandingConfigs.estetica
] as const;
