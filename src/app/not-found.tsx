import Link from "next/link";
import { FiHome } from "react-icons/fi";

import { BrandMark } from "@/components/composed/BrandMark";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-app px-6 text-primary">
      <div className="grid justify-items-center text-center">
        <BrandMark variant="compact" size="xl" priority />
        <h1 className="mt-6 text-7xl font-black leading-none sm:text-8xl">404</h1>
        <p className="mt-4 text-lg font-semibold text-muted">Página no encontrada</p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <FiHome className="text-base" aria-hidden="true" />
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
