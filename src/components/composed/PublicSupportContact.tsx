import { FiMail } from "react-icons/fi";

import { BrandMark } from "@/components/composed/BrandMark";

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "contacto@miturnolisto.com";
const supportMailHref = `mailto:${supportEmail}`;
const currentYear = new Date().getFullYear();

export function PublicSupportContact() {
  return (
    <>
      <footer className="bg-sidebar/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-7 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div className="grid gap-3">
            <BrandMark variant="full" size="sm" priority />
            <a
              href={supportMailHref}
              className="inline-flex w-fit cursor-pointer items-center gap-3 text-sm font-semibold !text-muted-strong transition-colors hover:!text-brand"
            >
              <FiMail className="text-lg" aria-hidden="true" />
              {supportEmail}
            </a>
            <p className="max-w-4xl text-sm leading-6 text-muted">
              Escribinos por dudas, soporte o consultas comerciales sobre MiTurnoListo.
            </p>
            <p className="text-sm font-semibold text-muted">
              &copy; {currentYear} MiTurnoListo. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>

      <a
        href={supportMailHref}
        aria-label="Contactarte con nosotros"
        className="group fixed bottom-5 right-5 z-40 grid h-14 w-14 cursor-pointer place-items-center rounded-full border border-brand bg-brand text-on-brand shadow-lg transition-all hover:-translate-y-0.5 hover:bg-sidebar hover:text-brand focus-visible:bg-sidebar focus-visible:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <div className="flex justify-center items-center text-white hover:text-brand w-full h-full">
        <span className="text-white pointer-events-none absolute bottom-full right-0 mb-3 w-max max-w-[14rem] rounded-lg bg-brand px-3 py-2 text-xs font-semibold opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          Contactarte con nosotros
        </span>
        <FiMail className="text-2xl" aria-hidden="true" />
        </div>
      </a>
    </>
  );
}
